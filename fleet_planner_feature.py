"""Live fleet-production planning and verified own-planet transports.

This module is deliberately installed as a small extension layer: raid behaviour
stays untouched, while the planner reuses the already authenticated CDP session.
No password is read or stored.  Sending is opt-in and stops on the first rejected
or unverified transport.
"""
from __future__ import annotations

import asyncio
import json
import math
import re
import time
from datetime import datetime, timedelta
from typing import Any

from browser import BrowserAutomationError, BrowserWorker, UnverifiedSendError
from config import FLEETS_URL


COMMAND_COORD = "2:5:6"
COMMAND_NAME = "clickm error 256"
MOSCOW_NAME = "москва"
PLANNING_EXCLUSIONS_KEY = "fleet_plan_excluded_planets"
DEFAULT_MEGA_CAPACITY = 44_000
RESOURCE_KEYS = ("metal", "minerals", "gas")


def _number(value: Any) -> int:
    digits = re.sub(r"[^0-9]", "", str(value or ""))
    return int(digits) if digits else 0


def _coord_tuple(value: str) -> tuple[int, int, int]:
    parts = str(value).replace(" ", "").split(":")
    if len(parts) != 3 or not all(part.isdigit() for part in parts):
        raise ValueError(f"Некорректные координаты: {value}")
    return tuple(int(part) for part in parts)  # type: ignore[return-value]


def _normal_name(value: str) -> str:
    return " ".join(str(value or "").casefold().replace("…", "").split())


def is_excluded_planet(planet: dict[str, Any], excluded_coords: set[str] | None = None) -> bool:
    """Exclude the command planet and any manually paused planning planet."""
    coord = str(planet.get("coord") or "").replace(" ", "")
    name = _normal_name(str(planet.get("name") or ""))
    command = coord == COMMAND_COORD or name == COMMAND_NAME or "klick" in name and "error" in name
    return command or coord in (excluded_coords or set())


def _resources(value: dict[str, Any]) -> dict[str, int]:
    return {key: max(0, _number(value.get(key))) for key in RESOURCE_KEYS}


def _sum_resources(items: list[dict[str, int]]) -> dict[str, int]:
    return {key: sum(item.get(key, 0) for item in items) for key in RESOURCE_KEYS}


def _short_number(value: int) -> str:
    value = int(value)
    if abs(value) >= 1_000_000:
        return f"{value / 1_000_000:.2f} млн"
    if abs(value) >= 1_000:
        return f"{value / 1_000:.1f} тыс"
    return str(value)


def _resource_lines(resources: dict[str, int]) -> str:
    return "\n".join((
        f"М  {_short_number(resources['metal'])}",
        f"Мин  {_short_number(resources['minerals'])}",
        f"Г  {_short_number(resources['gas'])}",
    ))


def _resource_inline(resources: dict[str, int]) -> str:
    return f"М {_short_number(resources['metal'])} · Мин {_short_number(resources['minerals'])} · Г {_short_number(resources['gas'])}"


def _allocate(total: int, planets: list[dict[str, Any]], mode: str) -> list[int]:
    if not planets:
        raise ValueError("Нет доступных планет для строительства")
    if total <= 0:
        raise ValueError("Количество кораблей должно быть больше нуля")
    if mode == "fastest":
        # More units go to planets with a lower authoritative per-unit time.
        weights = [1 / max(1, int(item.get("time_seconds") or 1)) for item in planets]
        raw = [total * weight / sum(weights) for weight in weights]
        units = [int(value) for value in raw]
        for index in sorted(range(len(planets)), key=lambda i: raw[i] - units[i], reverse=True)[: total - sum(units)]:
            units[index] += 1
        return units
    quotient, remainder = divmod(total, len(planets))
    return [quotient + (1 if index < remainder else 0) for index in range(len(planets))]


def build_transfer_plan(
    snapshot: dict[str, Any],
    ship_name: str,
    quantity: int,
    *,
    mode: str = "fastest",
    capacity: int = DEFAULT_MEGA_CAPACITY,
    quantities_by_coord: dict[str, int] | None = None,
    excluded_coords: set[str] | None = None,
) -> dict[str, Any]:
    """Build a deterministic preview without touching the game state."""
    planets = [dict(item) for item in snapshot.get("planets", []) if not is_excluded_planet(item, excluded_coords)]
    moscow = next((item for item in planets if _normal_name(item.get("name", "")) == MOSCOW_NAME), None)
    if moscow is None:
        raise ValueError("В снимке не найдена планета «Москва»")
    build_planets: list[dict[str, Any]] = []
    for planet in planets:
        ship = (planet.get("ships") or {}).get(ship_name)
        if ship:
            build_planets.append({
                **planet, "cost": _resources(ship.get("cost") or {}),
                "time_seconds": _number(ship.get("time_seconds")), "population": _number(ship.get("population")),
            })
    if not build_planets:
        raise ValueError(f"Корабль «{ship_name}» не найден на доступных планетах")
    # A saved "per planet" goal is different from an ordinary batch: it must
    # build precisely the missing amount on every planet, not redistribute a
    # total between them.
    units = (
        [max(0, int(quantities_by_coord.get(str(planet["coord"]), 0))) for planet in build_planets]
        if quantities_by_coord is not None
        else _allocate(int(quantity), build_planets, mode)
    )
    rows: list[dict[str, Any]] = []
    deficits: list[dict[str, int]] = []
    moscow_build_need = {key: 0 for key in RESOURCE_KEYS}
    population_sufficient = True
    for planet, amount in zip(build_planets, units):
        if amount <= 0:
            continue
        need = {key: amount * planet["cost"][key] for key in RESOURCE_KEYS}
        stock = _resources(planet.get("resources") or {})
        is_moscow = planet["coord"] == moscow["coord"]
        free_population = planet.get("hangar", {}).get("free")
        if free_population is None:
            raise ValueError(f"Неизвестно свободное население на планете «{planet['name']}»")
        population_need = amount * planet["population"]
        population_remainder = int(free_population) - population_need
        population_ok = population_remainder >= 0
        population_sufficient = population_sufficient and population_ok
        # Moscow builds from its own stock and never sends resources to itself.
        # Its construction cost is nevertheless part of the source sufficiency
        # check, alongside all outbound deliveries to the other planets.
        deficit = {key: 0 for key in RESOURCE_KEYS} if is_moscow else {
            key: max(0, need[key] - stock[key]) for key in RESOURCE_KEYS
        }
        cargo = sum(deficit.values())
        rows.append({
            "name": planet["name"], "coord": planet["coord"], "quantity": amount,
            "need": need, "stock": stock, "deficit": deficit,
            "time_seconds": planet["time_seconds"], "is_moscow": is_moscow,
            "population_per_ship": planet["population"], "population_free": int(free_population),
            "population_need": population_need, "population_remainder": population_remainder,
            "population_sufficient": population_ok,
            "mega_count": math.ceil(cargo / max(1, int(capacity))) if cargo else 0,
        })
        if is_moscow:
            moscow_build_need = need
        else:
            deficits.append(deficit)
    required = _sum_resources(deficits)
    available = _resources(moscow.get("resources") or {})
    remainder = {key: available[key] - moscow_build_need[key] - required[key] for key in RESOURCE_KEYS}
    transfers = [
        {"name": row["name"], "coord": row["coord"], "resources": row["deficit"], "ship_count": row["mega_count"]}
        for row in rows if row["mega_count"]
    ]
    return {
        "ship_name": ship_name, "quantity": sum(units), "mode": mode,
        "moscow": {
            "name": moscow["name"], "coord": moscow["coord"], "resources": available,
            "build_need": moscow_build_need,
        },
        "rows": rows, "required": required, "available": available, "remainder": remainder,
        "moscow_build_need": moscow_build_need,
        "resource_sufficient": all(value >= 0 for value in remainder.values()),
        "population_sufficient": population_sufficient,
        "sufficient": all(value >= 0 for value in remainder.values()) and population_sufficient,
        "transfers": transfers, "mega_capacity": max(1, int(capacity)),
    }


async def _planner_read_overview(self: BrowserWorker) -> list[dict[str, Any]]:
    page = await self._select_nemexia_page(create_if_missing=True)
    await self._assert_no_captcha(page, "captcha_planner_overview")
    overview_url = await page.evaluate(
        """() => Array.from(document.querySelectorAll('a[href*="overview.php?player_id="]'))
            .map(a => a.href).find(Boolean) || ''"""
    )
    if not overview_url:
        overview_url = FLEETS_URL.replace("fleets.php", "overview.php")
    await page.goto(str(overview_url), wait_until="domcontentloaded", timeout=30_000)
    await self._assert_no_captcha(page, "captcha_planner_overview_loaded")
    raw = await page.evaluate(
        r"""async () => {
          const text = value => (value || '').replace(/\s+/g, ' ').trim();
          const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
          const planets = Array.from(document.querySelectorAll('a.planetItem')).map(a => {
            const name = text(a.textContent);
            const id = (a.getAttribute('onclick') || '').match(/loadPlanetContent\((\d+)\)/)?.[1]
              || (a.href || '').match(/planet-(\d+)/)?.[1];
            const coord = name.match(/\[(\d+\s*:\s*\d+\s*:\s*\d+)\]/)?.[1]?.replace(/\s/g, '') || '';
            return id && coord ? {id, name: name.replace(/\s*\[[^\]]+\]\s*$/, ''), coord} : null;
          }).filter(Boolean);
          const read = async planet => {
            // «Просмотр» starts with every holder folded.  Open every planet
            // through the page's own handler and wait until its resource table
            // is actually rendered before reading it.
            const holder = document.querySelector('#PlanetContentHolder-' + planet.id);
            if (!holder?.querySelector('.overviewPlanet')) {
              const trigger = document.querySelector('a.planetItem[onclick*="loadPlanetContent(' + planet.id + ')"]');
              if (!trigger) throw new Error('Не найдена кнопка раскрытия планеты ' + planet.name);
              trigger.click();
              for (let attempt = 0; attempt < 50 && !holder.querySelector('.overviewPlanet'); attempt += 1) await sleep(150);
            }
            const row = Array.from(holder?.querySelectorAll('tr') || []).find(tr => text(tr.children[0]?.textContent).toLowerCase() === 'доступно');
            const values = row ? Array.from(row.children).slice(1, 4).map(cell => text(cell.textContent)) : [];
            const metrics = Array.from(holder?.querySelectorAll('.overviewPlanetInfo .row') || []);
            const metric = label => {
              const line = metrics.find(row => text(row.textContent).toLowerCase().startsWith(label.toLowerCase() + ' :'));
              return text(line?.querySelector('strong')?.textContent);
            };
            return {
              ...planet,
              resources: {metal: values[0] || '', minerals: values[1] || '', gas: values[2] || ''},
              hangar: {total: metric('Ангар'), used: metric('Используемые ангары'), free: metric('Свободные ангары')}
            };
          };
          const result = [];
          for (const planet of planets) result.push(await read(planet));
          return result;
        }"""
    )
    planets = []
    for item in raw:
        values = dict(item)
        hangar_raw = dict(values.get("hangar") or {})
        planets.append({
            **values,
            "resources": _resources(dict(values.get("resources") or {})),
            "hangar": {
                "total": _number(hangar_raw.get("total")),
                "used": _number(hangar_raw.get("used")),
                "free": _number(hangar_raw.get("free")) if hangar_raw.get("free") not in (None, "") else None,
            },
        })
    if not planets or not any(sum(item["resources"].values()) for item in planets):
        raise BrowserAutomationError("Не удалось прочитать ресурсы в «Союз → Просмотр». Проверь открытую игровую сессию.")
    if any(planet["hangar"]["free"] is None for planet in planets):
        raise BrowserAutomationError("Не удалось прочитать свободное население (ангар) у одной из планет.")
    return planets


async def _planner_read_ships(self: BrowserWorker, planets: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    page = await self._select_nemexia_page()
    ships_url = FLEETS_URL.replace("fleets.php", "ships.php")
    output: dict[str, dict[str, Any]] = {}
    for planet in planets:
        await self._assert_no_captcha(page, "captcha_planner_ship_scan")
        await self._select_planet(page, _coord_tuple(str(planet["coord"])))
        if "ships.php" not in page.url:
            await page.goto(ships_url, wait_until="domcontentloaded", timeout=30_000)
        await page.locator(".structureItem").first.wait_for(state="attached", timeout=15_000)
        # The shipyard refreshes its cards once after DOMContentLoaded.  A short
        # settle prevents us reading the initial placeholder values.
        await page.wait_for_timeout(350)
        output[str(planet["coord"])] = await page.evaluate(
            r"""() => {
              const value = id => document.querySelector(id)?.value || document.querySelector(id)?.textContent || '';
              const clean = value => String(value || '').replace(/[^0-9]/g, '');
              const durationSeconds = value => {
                const match = String(value || '').match(/(\d{1,2})\s*:\s*(\d{2})\s*:\s*(\d{2})/);
                return match ? String(Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])) : '';
              };
              const out = {};
              // Current fleet is authoritative in ShipsAvaible-<id>.  Do not
              // use the training form as the identity: a queued or disabled
              // card can temporarily omit/replace that form while the count
              // itself is still present.
              document.querySelectorAll('[id^="ShipsAvaible-"]').forEach(countNode => {
                const id = countNode.id.match(/^ShipsAvaible-(\d+)$/)?.[1];
                const item = countNode.closest('.structureItem');
                const name = (item?.querySelector('h3')?.textContent || '').replace(/\s+/g, ' ').trim();
                if (!id || !name) return;
                // The game removes ShipTimeId<N> from a disabled card (for
                // example, when resources are insufficient), while still
                // showing the real duration in .shipTime.  Availability and
                // build duration are separate facts, so always fall back to
                // the visible duration instead of turning it into zero.
                const hiddenTime = clean(value('#ShipTimeId' + id));
                const visibleTime = durationSeconds(item?.querySelector('.shipTime')?.textContent);
                 out[name] = {
                   ship_id: id,
                   cost: {metal: clean(value('#ShipsNeededMetal-' + id)), minerals: clean(value('#ShipsNeededCrystal-' + id)), gas: clean(value('#ShipsNeededGas-' + id))},
                   population: clean(value('#ShipsNeededPop-' + id)),
                   time_seconds: Number(hiddenTime) > 0 ? hiddenTime : visibleTime,
                   // ships.php exposes the actual fleet count directly on the
                   // card. Unlike fleets.php this is not tied to an open tab.
                   current: clean(value('#ShipsAvaible-' + id))
                 };
               });
               const queue = Array.from(document.querySelectorAll('#structuresQueue .queueItem')).map(item => ({
                 name: (item.querySelector('.details h3')?.textContent || '').replace(/\s+/g, ' ').trim(),
                 amount: clean(item.querySelector('.thumbnail span')?.textContent || '')
               })).filter(item => item.name && item.amount > 0);
               return {ships: out, queue};
            }"""
        )
    return output


async def scan_fleet_planner(self: BrowserWorker, refresh_times: bool = True) -> dict[str, Any]:
    """Read all owned resources and current ship costs/times from the live session."""
    planets = [planet for planet in await _planner_read_overview(self) if not is_excluded_planet(planet)]
    if not planets:
        raise BrowserAutomationError("После исключения командной планеты не осталось планет для планировщика")
    ships_by_coord = await _planner_read_ships(self, planets)
    for planet in planets:
        details = ships_by_coord.get(str(planet["coord"]), {})
        planet["ships"] = dict(details.get("ships") or {})
        planet["fleet"] = {name: _number(ship.get("current")) for name, ship in planet["ships"].items()}
        planet["factory_queue"] = list(details.get("queue") or [])
    # Return the page to Moscow when it is present, so existing raid controls stay predictable.
    page = await self._ensure_fleets_page()
    moscow = next((item for item in planets if _normal_name(item["name"]) == MOSCOW_NAME), None)
    if moscow:
        await self._select_planet(page, _coord_tuple(str(moscow["coord"])))
    return {"captured_at": datetime.now().astimezone().isoformat(), "planets": planets, "times_refreshed": bool(refresh_times)}


async def _planner_prepare_transport(self: BrowserWorker, page: Any, ship_count: int, home: tuple[int, int, int]) -> str:
    if ship_count <= 0:
        raise BrowserAutomationError("Для транспортировки нужен хотя бы один мегатранспортировщик")
    await self._select_planet(page, home)
    await page.evaluate("() => { if (typeof showTab === 'function') showTab('TabChooseShips'); }")
    await page.locator("#ship_1_2").wait_for(state="attached", timeout=10_000)
    available = int(await page.locator("#ship_1_2_max").get_attribute("value") or 0)
    if available < ship_count:
        raise BrowserAutomationError(f"Доступно мегатранспортировщиков: {available}, требуется: {ship_count}")
    await page.evaluate("""() => document.querySelectorAll('input.ships').forEach(el => {
        el.value='0'; el.dispatchEvent(new Event('change', {bubbles:true}));
    })""")
    await page.locator("select#mission").select_option("1")
    await page.evaluate("() => { if (typeof selectMissionImg === 'function') selectMissionImg(1); }")
    await page.locator("#ship_1_2").fill(str(ship_count))
    await page.locator("#ship_1_2").dispatch_event("change")
    await page.evaluate("() => shipsCheck()")
    try:
        await page.locator("#TabSendFleets").wait_for(state="visible", timeout=12_000)
    except Exception as exc:
        raise BrowserAutomationError("Игра не подтвердила выбор мегатранспортировщиков для транспортировки") from exc
    return await self._verify_home(page, home)


async def _planner_send_one(self: BrowserWorker, page: Any, transfer: dict[str, Any], home: tuple[int, int, int]) -> dict[str, Any]:
    resources = _resources(dict(transfer.get("resources") or {}))
    ship_count = int(transfer.get("ship_count") or 0)
    if not sum(resources.values()) or ship_count <= 0:
        raise BrowserAutomationError("Пустая транспортировка не отправляется")
    source = await _planner_prepare_transport(self, page, ship_count, home)
    target_coord = str(transfer.get("coord") or "")
    if target_coord == COMMAND_COORD:
        raise BrowserAutomationError("Командная планета исключена из транспортировок")
    timing = await self._set_target_coords(page, *_coord_tuple(target_coord))
    for selector, key in (("#loadMetal", "metal"), ("#loadCrystal", "minerals"), ("#loadGas", "gas")):
        await page.locator(selector).fill(str(resources[key]))
        await page.locator(selector).dispatch_event("change")
    capacity = await page.evaluate(
        """() => Number(String(document.querySelector('#missionCargo')?.textContent || '').replace(/[^0-9]/g, '')) || 0"""
    )
    if capacity and sum(resources.values()) > int(capacity):
        raise BrowserAutomationError(f"Груз для {target_coord} превышает доступную вместимость {capacity:,}")
    before_rows = await self._read_flights_from_page(page)
    before_ids = {str(row["id"]) for row in before_rows if row.get("id")}
    button = page.locator("#SendFleetButton")
    if await button.is_disabled():
        raise BrowserAutomationError("Игра не разрешает транспортировку. Проверь ресурсы, газ на полёт и свободные слоты.")
    try:
        async with page.expect_response(
            lambda response: "ajax_fleets.php" in response.url and response.request.method == "POST"
            and "type=SendFleet" in (response.request.post_data or ""), timeout=15_000
        ) as response_info:
            await button.click()
        response_text = await (await response_info.value).text()
    except Exception as exc:
        await self._assert_no_captcha(page, "captcha_transport_send")
        raise BrowserAutomationError("Не получен ответ игры на транспортировку") from exc
    try:
        payload = json.loads(response_text)
    except Exception:
        payload = {}
    if str(payload.get("pass")) == "0":
        raise BrowserAutomationError(str(payload.get("info") or "Игра отклонила транспортировку"))
    sent_at = datetime.now().astimezone()
    deadline = time.monotonic() + 12
    verified: dict[str, Any] | None = None
    while time.monotonic() < deadline:
        await asyncio.sleep(0.45)
        await page.evaluate("() => { if (typeof showFleets === 'function') showFleets(); }")
        rows = await self._read_flights_from_page(page)
        verified = next((row for row in rows if row.get("id") and str(row["id"]) not in before_ids
                         and str(row.get("target") or "").replace(" ", "") == target_coord
                         and "транспорт" in str(row.get("mission") or "").casefold()), None)
        if verified:
            break
    result = {"source": source, "target": target_coord, "resources": resources, "ship_count": ship_count,
              "sent_at": sent_at.isoformat(), "one_way_seconds": int(timing["one"]),
              "round_trip_seconds": int(timing["round"]), "gas_needed": timing.get("gas"),
              "fleet_id": str(verified.get("id")) if verified else None, "verified": bool(verified)}
    if not verified:
        raise UnverifiedSendError(
            "Игра могла принять транспортировку, но новая строка полёта не найдена. Пакет остановлен во избежание дубля.", result
        )
    return result


async def send_fleet_plan_transfers(self: BrowserWorker, transfers: list[dict[str, Any]], home: tuple[int, int, int]) -> list[dict[str, Any]]:
    """Send reviewed transfers serially; any failure stops the remaining batch."""
    page = await self._ensure_fleets_page()
    results: list[dict[str, Any]] = []
    for transfer in transfers:
        await self._assert_no_captcha(page, "captcha_transport_batch")
        results.append(await _planner_send_one(self, page, transfer, home))
    return results


async def _planner_preflight_build(self: BrowserWorker, plan: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Re-read every planet and reject the whole batch before any queue changes."""
    fresh = await scan_fleet_planner(self, refresh_times=True)
    planets = {str(planet["coord"]): planet for planet in fresh["planets"]}
    ship_name = str(plan.get("ship_name") or "")
    jobs: list[dict[str, Any]] = []
    problems: list[str] = []
    for row in plan.get("rows") or []:
        quantity = int(row.get("quantity") or 0)
        coord = str(row.get("coord") or "")
        if quantity <= 0:
            continue
        if coord == COMMAND_COORD:
            problems.append("Командная планета попала в план")
            continue
        planet = planets.get(coord)
        ship = (planet or {}).get("ships", {}).get(ship_name)
        if not planet or not ship:
            problems.append(f"{row.get('name') or coord}: корабль «{ship_name}» недоступен")
            continue
        need = {key: quantity * _number((ship.get("cost") or {}).get(key)) for key in RESOURCE_KEYS}
        stock = _resources(dict(planet.get("resources") or {}))
        missing = {key: max(0, need[key] - stock[key]) for key in RESOURCE_KEYS}
        free = planet.get("hangar", {}).get("free")
        population_need = quantity * _number(ship.get("population"))
        if any(missing.values()) or free is None or int(free) < population_need:
            parts = []
            if any(missing.values()):
                parts.append("ресурсы: " + _resource_inline(missing))
            if free is None or int(free) < population_need:
                parts.append(f"население: нужно {population_need:,}, свободно {_number(free):,}".replace(",", " "))
            problems.append(f"{planet['name']} [{coord}] — " + "; ".join(parts))
            continue
        jobs.append({
            "name": planet["name"], "coord": coord, "quantity": quantity,
            "ship_name": ship_name, "ship_id": _number(ship.get("ship_id")),
        })
    if problems:
        raise BrowserAutomationError(
            "Строительство не начато: после повторной проверки не хватает ресурсов или населения.\n"
            + "\n".join(f"• {problem}" for problem in problems)
            + "\n\nОбнови расчёт и отправь недостающие ресурсы транспортировками."
        )
    if not jobs:
        raise BrowserAutomationError("В текущем плане нет кораблей для строительства")
    return jobs, fresh


async def _planner_queue_ship_build(self: BrowserWorker, page: Any, job: dict[str, Any]) -> dict[str, Any]:
    """Use the same trainShips() request as the live game button and validate its answer."""
    await self._assert_no_captcha(page, "captcha_build_ship")
    await self._select_planet(page, _coord_tuple(str(job["coord"])))
    if "ships.php" not in page.url:
        await page.goto(FLEETS_URL.replace("fleets.php", "ships.php"), wait_until="domcontentloaded", timeout=30_000)
    ship_id = int(job["ship_id"])
    field = page.locator(f"#ShipId{ship_id}")
    await field.wait_for(state="attached", timeout=15_000)
    # The game's visible bulk button is «Строительство корабля» and calls
    # trainAllShips().  Zero every regular input first so a manually typed
    # value on the open page can never be queued accidentally with this plan.
    await page.evaluate(
        """({ shipId, count }) => {
          document.querySelectorAll('#TabShips input[id^="ShipId"]').forEach(input => { input.value = '0'; });
          const target = document.querySelector('#ShipId' + shipId);
          if (!target || typeof trainAllShips !== 'function') throw new Error('Кнопка строительства недоступна');
          target.value = String(count);
        }""",
        {"shipId": ship_id, "count": int(job["quantity"])},
    )
    try:
        async with page.expect_response(
            lambda response: "ajax_ships.php" in response.url and response.request.method == "POST"
            and "type=trainAll" in (response.request.post_data or ""), timeout=15_000,
        ) as response_info:
            await page.evaluate("() => trainAllShips()")
        response_text = await (await response_info.value).text()
    except Exception as exc:
        await self._assert_no_captcha(page, "captcha_build_ship_send")
        raise BrowserAutomationError(f"Не получен ответ игры на постановку в очередь: {job['name']}") from exc
    try:
        payload = json.loads(response_text)
        if isinstance(payload, str):
            payload = json.loads(payload)
    except Exception:
        payload = []
    if not isinstance(payload, list) or not payload or str(payload[0]).casefold() != "true":
        info = payload[1] if isinstance(payload, list) and len(payload) > 1 else "Игра отклонила строительство"
        raise BrowserAutomationError(f"{job['name']} [{job['coord']}]: {info}")
    return {**job, "queued_at": datetime.now().astimezone().isoformat(), "verified": True}


async def build_fleet_plan_ships(self: BrowserWorker, plan: dict[str, Any]) -> list[dict[str, Any]]:
    """Preflight all planets first, then queue builds serially and stop at the first failure."""
    jobs, fresh = await _planner_preflight_build(self, plan)
    page = await self._select_nemexia_page()
    results: list[dict[str, Any]] = []
    for job in jobs:
        try:
            results.append(await _planner_queue_ship_build(self, page, job))
        except Exception as exc:
            raise BrowserAutomationError(f"Строительство остановлено после {len(results)} из {len(jobs)} планет: {exc}") from exc
    page = await self._ensure_fleets_page()
    moscow = next((planet for planet in fresh["planets"] if _normal_name(planet["name"]) == MOSCOW_NAME), None)
    if moscow:
        await self._select_planet(page, _coord_tuple(str(moscow["coord"])))
    return results


def install_fleet_planner_feature(app_module: Any, app_class: type[Any]) -> None:
    """Attach the planner tab to the existing Tk application once."""
    if getattr(app_class, "_fleet_planner_feature_installed", False):
        return
    BrowserWorker.scan_fleet_planner = scan_fleet_planner  # type: ignore[attr-defined]
    BrowserWorker.send_fleet_plan_transfers = send_fleet_plan_transfers  # type: ignore[attr-defined]
    BrowserWorker.build_fleet_plan_ships = build_fleet_plan_ships  # type: ignore[attr-defined]
    original_build_shell = app_class._build_shell
    original_show_page = app_class.show_page
    original_render_all = app_class.render_all

    def planning_exclusions(self: Any) -> set[str]:
        raw = getattr(self, "fleet_planning_excluded_coords", None)
        if raw is None:
            raw = self.settings.get(PLANNING_EXCLUSIONS_KEY, [])
        return {str(coord).replace(" ", "") for coord in raw if str(coord).strip()}

    def set_planning_exclusions(self: Any, coords: set[str]) -> None:
        valid = {
            str(item.get("coord")).replace(" ", "")
            for snapshot in (getattr(self, "fleet_planner_snapshot", None), getattr(self, "fleet_manager_snapshot", None))
            if snapshot
            for item in snapshot.get("planets", [])
            if not is_excluded_planet(item)
        }
        self.fleet_planning_excluded_coords = {str(coord).replace(" ", "") for coord in coords} & valid
        self.settings[PLANNING_EXCLUSIONS_KEY] = sorted(self.fleet_planning_excluded_coords)
        self.db.set_setting(PLANNING_EXCLUSIONS_KEY, sorted(self.fleet_planning_excluded_coords))
        self.fleet_planner_plan = None
        if hasattr(self, "fleet_manager_plan"):
            self.fleet_manager_plan = None
        self.render_all()

    def edit_planning_exclusions(self: Any) -> None:
        snapshot = getattr(self, "fleet_planner_snapshot", None) or getattr(self, "fleet_manager_snapshot", None)
        if not snapshot or not snapshot.get("planets"):
            app_module.messagebox.showinfo(app_module.APP_NAME, "Сначала обнови мои планеты и координаты из игры.")
            return
        dialog = app_module.tk.Toplevel(self)
        dialog.title("Планеты в расчёте")
        dialog.configure(bg=app_module.BG)
        dialog.transient(self)
        dialog.grab_set()
        app_module.tk.Label(
            dialog,
            text="Сними галочку, чтобы временно исключить планету из производства и дислокаций.\n"
                 "Исключение не меняет планету в игре и действует до обратного включения.",
            justify="left", bg=app_module.BG, fg=app_module.TEXT, padx=18, pady=14,
        ).pack(anchor="w")
        body = app_module.tk.Frame(dialog, bg=app_module.PANEL, padx=14, pady=10)
        body.pack(fill="both", expand=True, padx=18)
        excluded = planning_exclusions(self)
        variables: dict[str, Any] = {}
        for planet in snapshot.get("planets", []):
            if is_excluded_planet(planet):
                continue
            coord = str(planet.get("coord") or "")
            variable = app_module.tk.BooleanVar(value=coord not in excluded)
            variables[coord] = variable
            app_module.tk.Checkbutton(
                body, text=f"{planet.get('name')} [{coord}]", variable=variable,
                bg=app_module.PANEL, fg=app_module.TEXT, activebackground=app_module.PANEL,
                activeforeground=app_module.TEXT, selectcolor=app_module.PANEL_ALT,
                anchor="w",
            ).pack(fill="x", anchor="w", pady=2)
        controls = app_module.tk.Frame(dialog, bg=app_module.BG, padx=18, pady=14)
        controls.pack(fill="x")
        def save() -> None:
            set_planning_exclusions(self, {coord for coord, variable in variables.items() if not variable.get()})
            dialog.destroy()
        app_module.make_button(controls, "Сохранить", save, "primary").pack(side="right")
        app_module.make_button(controls, "Отмена", dialog.destroy, "ghost").pack(side="right", padx=(0, 8))

    def build_page(self: Any) -> None:
        tk, ttk = app_module.tk, app_module.ttk
        page = self._new_page("fleet_planner")
        # The native combobox popup is not styled by the global ttk theme on
        # every Windows build.  Give both the field and its listbox explicit
        # dark, high-contrast colours so selected text never becomes white on
        # a white background.
        style = ttk.Style(self)
        style.configure("Planner.TCombobox", fieldbackground=app_module.INPUT, background=app_module.INPUT,
                        foreground=app_module.TEXT, arrowcolor=app_module.TEXT, bordercolor=app_module.BORDER)
        style.map("Planner.TCombobox", fieldbackground=[("readonly", app_module.INPUT)],
                  foreground=[("readonly", app_module.TEXT)], selectforeground=[("readonly", app_module.TEXT)],
                  selectbackground=[("readonly", app_module.INPUT)])
        self.option_add("*TCombobox*Listbox.background", app_module.INPUT)
        self.option_add("*TCombobox*Listbox.foreground", app_module.TEXT)
        self.option_add("*TCombobox*Listbox.selectBackground", app_module.ACCENT)
        self.option_add("*TCombobox*Listbox.selectForeground", app_module.TEXT)
        toolbar = tk.Frame(page, bg=app_module.BG)
        toolbar.pack(fill="x", pady=(0, 12))
        # Keep the production toolbar intentionally small: it is used during
        # active play, while coordinate refresh is one global action upstairs.
        app_module.make_button(toolbar, "Снять данные из игры", self.planner_scan, "primary").pack(side="left")
        app_module.make_button(toolbar, "Рассчитать", self.planner_calculate, "secondary").pack(side="left", padx=8)
        self.planner_send_button = app_module.make_button(toolbar, "Отправить транспортировки", self.planner_send, "ghost")
        self.planner_send_button.pack(side="right")
        self.planner_build_button = app_module.make_button(toolbar, "Запустить строительство", self.planner_build, "primary")
        self.planner_build_button.pack(side="right", padx=(0, 8))
        self.planner_refresh_times_var = tk.BooleanVar(value=True)
        tk.Checkbutton(toolbar, text="Обновить цены и время строительства", variable=self.planner_refresh_times_var,
                       bg=app_module.BG, fg=app_module.MUTED, activebackground=app_module.BG,
                       activeforeground=app_module.TEXT, selectcolor=app_module.PANEL_ALT).pack(side="right", padx=14)
        inputs = tk.Frame(page, bg=app_module.PANEL, padx=16, pady=13, highlightbackground=app_module.BORDER, highlightthickness=1)
        inputs.pack(fill="x", pady=(0, 12))
        tk.Label(inputs, text="Корабль", bg=app_module.PANEL, fg=app_module.MUTED).grid(row=0, column=0, sticky="w")
        self.planner_ship_var = tk.StringVar()
        self.planner_ship_box = ttk.Combobox(inputs, textvariable=self.planner_ship_var, state="readonly", width=28,
                                             style="Planner.TCombobox")
        self.planner_ship_box.grid(row=1, column=0, sticky="w", padx=(0, 18))
        self.planner_ship_box.bind("<<ComboboxSelected>>", lambda _event: load_build_goal(self))
        self.planner_goal_label_var = tk.StringVar(value="Количество к созданию")
        tk.Label(inputs, textvariable=self.planner_goal_label_var, bg=app_module.PANEL, fg=app_module.MUTED).grid(row=0, column=1, sticky="w")
        self.planner_quantity_var = tk.IntVar(value=100)
        tk.Spinbox(inputs, from_=1, to=1_000_000, textvariable=self.planner_quantity_var, width=12,
                   bg=app_module.INPUT, fg=app_module.TEXT, insertbackground=app_module.TEXT).grid(row=1, column=1, sticky="w", padx=(0, 18))
        tk.Label(inputs, text="Распределение", bg=app_module.PANEL, fg=app_module.MUTED).grid(row=0, column=2, sticky="w")
        self.planner_mode_var = tk.StringVar(value="По скорости строительства")
        self.planner_mode_box = ttk.Combobox(inputs, textvariable=self.planner_mode_var,
                                             values=("Равномерно", "По скорости строительства"), state="readonly",
                                             width=27, style="Planner.TCombobox")
        self.planner_mode_box.grid(row=1, column=2, sticky="w")
        tk.Label(inputs, text="Режим цели", bg=app_module.PANEL, fg=app_module.MUTED).grid(row=0, column=3, sticky="w", padx=(18, 0))
        self.planner_goal_mode_var = tk.StringVar(value="Создать всего")
        self.planner_goal_mode_box = ttk.Combobox(
            inputs, textvariable=self.planner_goal_mode_var,
            values=("Создать всего", "Довести каждую планету до", "Из плана флота"), state="readonly", width=27,
            style="Planner.TCombobox",
        )
        self.planner_goal_mode_box.grid(row=1, column=3, sticky="w", padx=(18, 0))
        self.planner_exclusions_var = tk.StringVar(value="Все планеты в расчёте")
        app_module.make_button(inputs, "Планеты в расчёте…", self.fleet_plan_edit_exclusions, "ghost").grid(
            row=1, column=4, sticky="w", padx=(18, 0)
        )
        tk.Label(inputs, textvariable=self.planner_exclusions_var, bg=app_module.PANEL, fg=app_module.MUTED,
                 font=("Segoe UI", 8)).grid(row=2, column=3, columnspan=2, sticky="w", padx=(18, 0), pady=(10, 0))
        def update_goal_label(*_args: Any) -> None:
            per_planet = self.planner_goal_mode_var.get() == "Довести каждую планету до"
            from_plan = self.planner_goal_mode_var.get() == "Из плана флота"
            self.planner_goal_label_var.set("Из общего плана" if from_plan else ("Цель на каждой планете" if per_planet else "Количество к созданию"))
        self.planner_goal_mode_var.trace_add("write", update_goal_label)
        tk.Label(
            inputs,
            text=("По скорости строительства (по умолчанию) — больше кораблей на быстрых планетах, "
                  "чтобы все закончили примерно одновременно.\n"
                   "Равномерно — одинаковое число кораблей на каждой планете.\n"
                   "«Довести каждую планету до» сохраняет цель для выбранного корабля и строит только недостающее."),
            justify="left", wraplength=590, bg=app_module.PANEL, fg=app_module.MUTED, font=("Segoe UI", 8),
        ).grid(row=2, column=0, columnspan=3, sticky="w", pady=(10, 0))
        summary = tk.Frame(page, bg=app_module.BG)
        summary.pack(fill="x", pady=(0, 10))
        self.planner_moscow_build_var = tk.StringVar(value="—")
        self.planner_delivery_var = tk.StringVar(value="—")
        self.planner_remainder_var = tk.StringVar(value="—")
        for index, (title, variable) in enumerate((
            ("МОСКВА ПОСТРОИТ ИЗ СВОИХ", self.planner_moscow_build_var),
            ("ОТПРАВИТЬ НА ДРУГИЕ ПЛАНЕТЫ", self.planner_delivery_var),
            ("ОСТАТОК МОСКВЫ ПОСЛЕ ПЛАНА", self.planner_remainder_var),
        )):
            summary.grid_columnconfigure(index, weight=1)
            card = tk.Frame(summary, bg=app_module.PANEL_ALT, padx=14, pady=11,
                            highlightbackground=app_module.BORDER, highlightthickness=1)
            card.grid(row=0, column=index, sticky="ew", padx=(0 if index == 0 else 6, 0))
            tk.Label(card, text=title, bg=app_module.PANEL_ALT, fg=app_module.MUTED,
                     font=("Segoe UI Semibold", 8)).pack(anchor="w")
            tk.Label(card, textvariable=variable, bg=app_module.PANEL_ALT, fg=app_module.TEXT,
                     font=("Segoe UI Semibold", 10), anchor="w").pack(anchor="w", pady=(5, 0))
        self.planner_status_var = tk.StringVar(value="Сначала сними актуальные данные из игры.")
        tk.Label(page, textvariable=self.planner_status_var, bg=app_module.PANEL_ALT, fg=app_module.MUTED,
                 anchor="w", padx=14, pady=9, font=("Segoe UI", 9)).pack(fill="x", pady=(0, 10))
        style.configure("Planner.Treeview", background=app_module.PANEL, fieldbackground=app_module.PANEL,
                        foreground=app_module.TEXT, rowheight=72, borderwidth=0, font=("Segoe UI", 9))
        style.configure("Planner.Treeview.Heading", background=app_module.PANEL_ALT, foreground=app_module.MUTED,
                        relief="flat", font=("Segoe UI Semibold", 9), padding=(9, 10))
        style.map("Planner.Treeview", background=[("selected", app_module.ACCENT)], foreground=[("selected", app_module.TEXT)])
        self.planner_tree = ttk.Treeview(page, columns=("planet", "ships", "time", "need", "stock", "send", "population"),
                                          show="headings", style="Planner.Treeview")
        headings = (("planet", "Планета"), ("ships", "Строить"), ("time", "Время"), ("need", "Требуется"),
                    ("stock", "Уже есть"), ("send", "Доставка с Москвы"), ("population", "Ангар / население"))
        widths = {"planet": 165, "ships": 78, "time": 118, "need": 148, "stock": 148, "send": 170, "population": 165}
        for key, text in headings:
            self.planner_tree.heading(key, text=text)
            self.planner_tree.column(key, width=widths[key], minwidth=widths[key], anchor="w")
        self.planner_tree.pack(fill="both", expand=True)
        self.planner_tree.tag_configure("moscow", background="#152a45")
        self.planner_tree.tag_configure("population_error", background="#4a2029")

    def patched_build_shell(self: Any) -> None:
        original_build_shell(self)
        queue_button = self.nav_buttons["queue"]
        # The visual shell wraps every navigation item in a row containing a
        # coloured rail.  Build the planner item with the same topology instead
        # of adding a button inside the queue row.
        nav_group = queue_button.master.master
        base_bg = str(queue_button.cget("bg"))
        active_bg = str(queue_button.cget("activebackground"))
        base_fg = str(queue_button.cget("fg"))
        active_fg = str(queue_button.cget("activeforeground"))
        row = app_module.tk.Frame(nav_group, bg=base_bg)
        row.pack(fill="x", padx=10, pady=2, before=queue_button.master)
        rail = app_module.tk.Frame(row, bg=base_bg, width=3, height=31)
        rail.pack(side="left", fill="y")
        button = app_module.tk.Button(row, text="▣  Корабли", anchor="w", command=lambda: self.show_page("fleet_planner"),
                                      bg=base_bg, fg=base_fg, activebackground=active_bg, activeforeground=active_fg,
                                      relief="flat", bd=0, padx=14, pady=9, cursor="hand2", highlightthickness=0,
                                      font=queue_button.cget("font"))
        button.pack(side="left", fill="x", expand=True)
        setattr(button, "_nav_rail", rail)
        self._planner_nav_colors = (base_bg, active_bg, base_fg, active_fg)
        self.nav_buttons["fleet_planner"] = button
        self.fleet_planner_snapshot: dict[str, Any] | None = None
        self.fleet_planner_plan: dict[str, Any] | None = None
        build_page(self)

    def render_planner(self: Any) -> None:
        if not hasattr(self, "planner_tree"):
            return
        for item in self.planner_tree.get_children():
            self.planner_tree.delete(item)
        plan = self.fleet_planner_plan
        if hasattr(self, "planner_exclusions_var"):
            excluded = planning_exclusions(self)
            self.planner_exclusions_var.set(
                "Все планеты в расчёте" if not excluded else f"Исключено из расчёта: {len(excluded)} планет(ы)"
            )
        if not plan:
            self.planner_send_button.configure(state="disabled")
            self.planner_build_button.configure(state="disabled")
            self.planner_moscow_build_var.set("—")
            self.planner_delivery_var.set("—")
            self.planner_remainder_var.set("—")
            return
        for row in plan["rows"]:
            needed = row["need"]
            stock = row["stock"]
            deficit = row["deficit"]
            population_text = (
                f"своб.  {_short_number(row['population_free'])}\n"
                f"нужно  {_short_number(row['population_need'])} · {row['population_per_ship']}×{row['quantity']}\n"
            )
            population_text += (
                f"после  {_short_number(row['population_remainder'])}"
                if row["population_sufficient"] else f"НЕ ХВАТИТ  {_short_number(-row['population_remainder'])}"
            )
            self.planner_tree.insert("", "end", values=(
                f"{row['name']}\n[{row['coord']}]", f"{row['quantity']} шт.",
                f"за шт. {app_module.format_duration(row['time_seconds'])}\nвсего {app_module.format_duration(row['quantity'] * row['time_seconds'])}",
                _resource_lines(needed), _resource_lines(stock),
                "строит из своих" if row["is_moscow"] else
                _resource_lines(deficit),
                population_text,
            ), tags=("population_error",) if not row["population_sufficient"] else
            (("moscow",) if row["is_moscow"] else ()))
        required, available, own_need, remainder = (
            plan["required"], plan["available"], plan["moscow_build_need"], plan["remainder"]
        )
        if not plan["resource_sufficient"]:
            verdict = "НЕДОСТАТОЧНО РЕСУРСОВ МОСКВЫ"
        elif not plan["population_sufficient"]:
            blocked = [
                f"{row['name']}: свободно {_short_number(row['population_free'])}, нужно {_short_number(row['population_need'])}"
                for row in plan["rows"] if not row["population_sufficient"]
            ]
            verdict = "НЕ ХВАТАЕТ СВОБОДНОГО НАСЕЛЕНИЯ — " + "; ".join(blocked)
        else:
            verdict = "ПЛАН МОЖНО СТРОИТЬ"
        self.planner_moscow_build_var.set(_resource_inline(own_need))
        self.planner_delivery_var.set(_resource_inline(required))
        self.planner_remainder_var.set(_resource_inline(remainder))
        self.planner_status_var.set(
            f"{verdict}. План включает Москву; рейсов на другие планеты: {len(plan['transfers'])}. "
            "Топливо игра проверит перед каждым рейсом."
        )
        self.planner_send_button.configure(state="normal" if plan["sufficient"] and plan["transfers"] else "disabled")
        self.planner_build_button.configure(state="normal" if plan["sufficient"] else "disabled")

    def planner_scan(self: Any) -> None:
        endpoint = self.endpoint()
        refresh = bool(self.planner_refresh_times_var.get())
        async def operation() -> dict[str, Any]:
            await self.worker.connect(endpoint)
            return await self.worker.scan_fleet_planner(refresh)  # type: ignore[attr-defined]
        def success(snapshot: dict[str, Any]) -> None:
            self.connected = True
            # Prices are always live (they can change through specialisations).
            # The optional checkbox specifically controls whether cached build
            # durations are replaced; a first scan necessarily establishes them.
            previous = self.fleet_planner_snapshot
            if not refresh and previous:
                cached_times = {
                    (str(planet.get("coord")), name): ship.get("time_seconds")
                    for planet in previous.get("planets", [])
                    for name, ship in (planet.get("ships") or {}).items()
                }
                for planet in snapshot["planets"]:
                    for name, ship in (planet.get("ships") or {}).items():
                        cached = cached_times.get((str(planet.get("coord")), name))
                        if cached is not None:
                            ship["time_seconds"] = cached
            if hasattr(self, "_apply_live_fleet_snapshot"):
                self._apply_live_fleet_snapshot(snapshot)
            else:
                self.fleet_planner_snapshot = snapshot
                self.fleet_planner_plan = None
            names = sorted({name for planet in snapshot["planets"] for name in (planet.get("ships") or {})})
            self.planner_ship_box.configure(values=names)
            if names and self.planner_ship_var.get() not in names:
                self.planner_ship_var.set(next((name for name in names if "разрушитель" in name.casefold()), names[0]))
            load_build_goal(self)
            timing = "время обновлено" if refresh or not previous else "сохранено предыдущее время"
            self.planner_status_var.set(
                f"Снимок получен: {len(snapshot['planets'])} планет; цены обновлены, {timing}. "
                f"Исключено вручную: {len(planning_exclusions(self))}. Командная планета не учитывается."
            )
            render_planner(self)
        self.run_task(operation(), "Считывание ресурсов, цен и времени…", success)

    def load_build_goal(self: Any) -> None:
        """Restore a saved per-planet production target for the selected ship."""
        if self.planner_goal_mode_var.get() != "Довести каждую планету до":
            return
        value = dict(self.settings.get("fleet_build_goals", {}) or {}).get(self.planner_ship_var.get())
        if value is not None:
            self.planner_quantity_var.set(max(1, int(value)))

    def planner_calculate(self: Any) -> None:
        if not self.fleet_planner_snapshot:
            app_module.messagebox.showinfo(app_module.APP_NAME, "Сначала нажми «Снять данные из игры».")
            return
        try:
            ship_name = self.planner_ship_var.get()
            requested = int(self.planner_quantity_var.get())
            snapshot = self.fleet_planner_snapshot
            excluded_coords = planning_exclusions(self)
            per_planet = self.planner_goal_mode_var.get() == "Довести каждую планету до"
            quantities_by_coord = None
            if per_planet:
                quantities_by_coord = {
                    str(planet.get("coord")): max(0, requested - int((planet.get("fleet") or {}).get(ship_name, 0)))
                    for planet in snapshot.get("planets", []) if not is_excluded_planet(planet, excluded_coords)
                }
                saved = dict(self.settings.get("fleet_build_goals", {}) or {})
                saved[ship_name] = requested
                self.settings["fleet_build_goals"] = saved
                self.db.set_setting("fleet_build_goals", saved)
            elif self.planner_goal_mode_var.get() == "Из плана флота":
                backlog = dict(self.settings.get("fleet_manager_build_requirements", {}) or {})
                quantities_by_coord = {str(coord): max(0, int(dict(items or {}).get(ship_name, 0))) for coord, items in backlog.items()}
                requested = sum(quantities_by_coord.values())
                if not requested:
                    raise ValueError(f"В общем плане нет дефицита для «{ship_name}».")
            self.fleet_planner_plan = build_transfer_plan(
                snapshot, ship_name, requested,
                mode="fastest" if self.planner_mode_var.get() == "По скорости строительства" else "equal",
                quantities_by_coord=quantities_by_coord,
                excluded_coords=excluded_coords,
            )
        except (TypeError, ValueError) as exc:
            app_module.messagebox.showerror(app_module.APP_NAME, str(exc))
            return
        render_planner(self)

    def planner_send(self: Any) -> None:
        plan = self.fleet_planner_plan
        if not plan or not plan.get("sufficient"):
            return
        if not app_module.messagebox.askyesno(
            app_module.APP_NAME,
            f"Отправить {len(plan['transfers'])} транспортировок с Москвы?\n\n"
            "Перед каждым рейсом игра повторно проверит корабли, груз, топливо и слоты. "
            "При первой ошибке пакет остановится.",
        ):
            return
        endpoint = self.endpoint()
        home = _coord_tuple(plan["moscow"]["coord"])
        async def operation() -> list[dict[str, Any]]:
            await self.worker.connect(endpoint)
            return await self.worker.send_fleet_plan_transfers(plan["transfers"], home)  # type: ignore[attr-defined]
        def success(results: list[dict[str, Any]]) -> None:
            self.status_var.set("Транспортировки отправлены")
            self.planner_status_var.set(f"Подтверждено транспортировок: {len(results)}. Обнови снимок перед следующим планом.")
            self.fleet_planner_plan = None
            render_planner(self)
        self.run_task(operation(), "Отправка транспортировок…", success)

    def planner_build(self: Any) -> None:
        plan = self.fleet_planner_plan
        if not plan or not plan.get("sufficient"):
            return
        rows = [row for row in plan.get("rows", []) if int(row.get("quantity") or 0) > 0]
        if not rows:
            return
        if not app_module.messagebox.askyesno(
            app_module.APP_NAME,
            f"Запустить строительство «{plan['ship_name']}» — всего {plan['quantity']} шт. на {len(rows)} планетах?\n\n"
            "Сначала программа заново проверит ресурсы, цены и свободное население на ВСЕХ планетах. "
            "Если хотя бы на одной планете чего-то не хватает, строительство не начнётся нигде.\n\n"
            "После успешной проверки игра получит те же команды, что и при кнопке «Строительство корабля». "
            "При первом отказе игры пакет будет остановлен.",
        ):
            return
        endpoint = self.endpoint()
        async def operation() -> list[dict[str, Any]]:
            await self.worker.connect(endpoint)
            return await self.worker.build_fleet_plan_ships(plan)  # type: ignore[attr-defined]
        def success(results: list[dict[str, Any]]) -> None:
            self.status_var.set("Строительство запущено")
            self.planner_status_var.set(
                f"Подтверждено очередей строительства: {len(results)}. Сними новый снимок перед следующим планом."
            )
            self.fleet_planner_plan = None
            render_planner(self)
        def error(exc: Exception) -> None:
            self.planner_status_var.set(f"Строительство не запущено или остановлено: {exc}")
            # A failed batch may contain a few already accepted queues.  Never
            # leave a stale plan enabled, otherwise a retry could duplicate it.
            self.fleet_planner_plan = None
            render_planner(self)
            app_module.messagebox.showerror(app_module.APP_NAME, str(exc))
        self.run_task(operation(), "Проверка ресурсов и запуск строительства…", success, error)

    def patched_show_page(self: Any, key: str) -> None:
        if key == "fleet_planner":
            self.current_page = key
            self.page_title_var.set("Корабли — производство")
            self.pages[key].tkraise()
            base_bg, active_bg, base_fg, active_fg = self._planner_nav_colors
            for nav_key, button in self.nav_buttons.items():
                selected = nav_key == key
                button.configure(bg=active_bg if selected else base_bg, fg=active_fg if selected else base_fg)
                rail = getattr(button, "_nav_rail", None)
                if rail is not None:
                    rail.configure(bg=app_module.ACCENT if selected else base_bg)
            render_planner(self)
            return
        original_show_page(self, key)

    def patched_render_all(self: Any) -> None:
        original_render_all(self)
        render_planner(self)

    # Bind callbacks before the patched shell constructs its controls.  Tk
    # resolves ``self.planner_scan`` during widget creation, not on first click.
    app_class.planner_scan = planner_scan
    app_class.fleet_plan_edit_exclusions = edit_planning_exclusions
    app_class.fleet_plan_set_exclusions = set_planning_exclusions
    app_class.planner_load_build_goal = load_build_goal
    app_class.planner_calculate = planner_calculate
    app_class.planner_send = planner_send
    app_class.planner_build = planner_build
    app_class._build_shell = patched_build_shell
    app_class.show_page = patched_show_page
    app_class.render_all = patched_render_all
    app_class._fleet_planner_feature_installed = True
