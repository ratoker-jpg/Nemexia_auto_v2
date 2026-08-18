"""Persistent fleet goals, live hangar-aware distribution and Dislocation actions.

This is deliberately separate from the production planner: the production screen
answers "what should be built", while this module answers "where is the fleet
now and what has to move".  Both use the same authenticated browser session.
"""
from __future__ import annotations

import asyncio
import json
import time
from collections import defaultdict
from datetime import datetime
from typing import Any

from browser import BrowserAutomationError, BrowserWorker, UnverifiedSendError
from fleet_planner_feature import (
    PLANNING_EXCLUSIONS_KEY, _coord_tuple, _normal_name, _number, is_excluded_planet,
)


TARGETS_KEY = "fleet_manager_targets"
LOCKS_KEY = "fleet_manager_locked_planets"
SNAPSHOT_KEY = "fleet_manager_snapshot"
FILLERS_KEY = "fleet_manager_filler_ships"
BUILD_REQUIREMENTS_KEY = "fleet_manager_build_requirements"


def _short(value: int) -> str:
    value = int(value)
    if abs(value) >= 1_000_000:
        return f"{value / 1_000_000:.2f} млн"
    if abs(value) >= 1_000:
        return f"{value / 1_000:.1f} тыс"
    return str(value)


def _ship_weight(planet: dict[str, Any], ship_name: str) -> int:
    return max(0, _number(((planet.get("ships") or {}).get(ship_name) or {}).get("population")))


def fleet_load(planet: dict[str, Any]) -> int:
    """Population occupied by the currently scanned, movable fleet."""
    return sum(
        max(0, int(amount or 0)) * _ship_weight(planet, name)
        for name, amount in (planet.get("fleet") or {}).items()
    )


def calculate_fleet_readiness(
    snapshot: dict[str, Any], fixed_targets: dict[str, dict[str, int]], fillers: dict[str, str],
    excluded_coords: set[str] | None = None,
) -> dict[str, Any]:
    """Materialise ideal per-planet fleets and the exact production backlog."""
    targets: dict[str, dict[str, int]] = {}
    rows_by_coord: dict[str, list[dict[str, Any]]] = {}
    requirements: dict[str, dict[str, int]] = {}
    warnings: list[str] = []
    for planet in snapshot.get("planets", []):
        if is_excluded_planet(planet, excluded_coords):
            continue
        coord = str(planet.get("coord"))
        fixed = {name: max(0, int(amount or 0)) for name, amount in (fixed_targets.get(coord, {}) or {}).items()}
        total = max(0, int((planet.get("hangar") or {}).get("total") or 0))
        fixed_load = sum(amount * _ship_weight(planet, name) for name, amount in fixed.items())
        filler = str(fillers.get(coord) or "")
        ideal = dict(fixed)
        if filler and filler not in fixed:
            weight = _ship_weight(planet, filler)
            if weight:
                ideal[filler] = max(0, total - fixed_load) // weight
        if fixed_load > total:
            warnings.append(f"{planet.get('name')}: ручные цели превышают вместимость ангара")
        queue = {str(item.get("name")): max(0, int(item.get("amount") or 0)) for item in (planet.get("factory_queue") or [])}
        current = {str(name): max(0, int(amount or 0)) for name, amount in (planet.get("fleet") or {}).items()}
        rows: list[dict[str, Any]] = []
        requirements[coord] = {}
        all_names = sorted(set(ideal) | set(current) | set(queue))
        for name in all_names:
            desired, actual, building = ideal.get(name, 0), current.get(name, 0), queue.get(name, 0)
            missing = max(0, desired - actual - building)
            if missing:
                requirements[coord][name] = missing
            rows.append({"ship_name": name, "target": desired, "actual": actual, "queued": building,
                         "missing": missing, "excess": max(0, actual - desired),
                         "weight": _ship_weight(planet, name), "is_filler": name == filler})
        targets[coord] = ideal
        rows_by_coord[coord] = rows
    requirements = {coord: items for coord, items in requirements.items() if items}
    by_ship: dict[str, int] = defaultdict(int)
    for items in requirements.values():
        for name, amount in items.items(): by_ship[name] += amount
    return {"targets": targets, "rows_by_coord": rows_by_coord, "requirements": requirements,
            "requirements_by_ship": dict(by_ship), "warnings": warnings}


def calculate_dislocation_plan(
    snapshot: dict[str, Any], targets: dict[str, dict[str, int]], locked: dict[str, bool],
    excluded_coords: set[str] | None = None,
) -> dict[str, Any]:
    """Create a deterministic, capacity-safe preview without touching the game."""
    planets = [dict(item) for item in snapshot.get("planets", []) if not is_excluded_planet(item, excluded_coords)]
    by_coord = {str(item.get("coord")): item for item in planets}
    state = {coord: {name: max(0, int(count or 0)) for name, count in (planet.get("fleet") or {}).items()}
             for coord, planet in by_coord.items()}
    free = {coord: max(0, int((planet.get("hangar") or {}).get("free") or 0)) for coord, planet in by_coord.items()}
    moves: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []

    # A source may give away only what remains above its own saved target.
    for target_coord, wanted in sorted(targets.items()):
        target = by_coord.get(str(target_coord))
        if not target:
            continue
        for ship_name, desired_raw in sorted((wanted or {}).items()):
            desired = max(0, int(desired_raw or 0))
            current = state[target_coord].get(ship_name, 0)
            missing = max(0, desired - current)
            if not missing:
                continue
            weight = _ship_weight(target, ship_name)
            # Ship weights are live game data.  Missing metadata must never let
            # the planner silently overfill a planet.
            room = free[target_coord] // weight if weight else 0
            transferable = min(missing, room)
            remaining = transferable
            candidates: list[tuple[int, str]] = []
            for source_coord, source in by_coord.items():
                if source_coord == target_coord or locked.get(source_coord, False):
                    continue
                own_goal = max(0, int((targets.get(source_coord, {}) or {}).get(ship_name, 0)))
                spare = max(0, state[source_coord].get(ship_name, 0) - own_goal)
                if spare:
                    candidates.append((spare, source_coord))
            for spare, source_coord in sorted(candidates, key=lambda item: (-item[0], item[1])):
                amount = min(remaining, spare)
                if amount <= 0:
                    continue
                source = by_coord[source_coord]
                source_weight = _ship_weight(source, ship_name)
                moves.append({
                    "source_coord": source_coord, "source_name": source.get("name", source_coord),
                    "target_coord": target_coord, "target_name": target.get("name", target_coord),
                    "ship_name": ship_name, "amount": amount, "population": amount * weight,
                })
                state[source_coord][ship_name] = state[source_coord].get(ship_name, 0) - amount
                state[target_coord][ship_name] = state[target_coord].get(ship_name, 0) + amount
                free[source_coord] += amount * source_weight
                free[target_coord] -= amount * weight
                remaining -= amount
                if not remaining:
                    break
            unmet = missing - (transferable - remaining)
            if unmet:
                reason = "недостаточно свободного ангара" if room < missing else "недостаточно доступных кораблей"
                unresolved.append({
                    "coord": target_coord, "name": target.get("name", target_coord), "ship_name": ship_name,
                    "amount": unmet, "reason": reason,
                })

    return {"moves": moves, "unresolved": unresolved, "projected_fleet": state, "projected_free": free}


async def scan_fleet_manager(self: BrowserWorker) -> dict[str, Any]:
    """Read live fleet, factory queue, weights and hangar limits from ships.php."""
    snapshot = await self.scan_fleet_planner(True)  # type: ignore[attr-defined]
    snapshot["captured_at"] = datetime.now().astimezone().isoformat()
    return snapshot


async def _send_one_dislocation(self: BrowserWorker, page: Any, move: dict[str, Any], ships: dict[str, dict[str, Any]]) -> dict[str, Any]:
    source_coord, target_coord = str(move["source_coord"]), str(move["target_coord"])
    ship_name, amount = str(move["ship_name"]), int(move["amount"])
    ship_id = str((ships.get(ship_name) or {}).get("ship_id") or "")
    if not ship_id or amount <= 0:
        raise BrowserAutomationError(f"Некорректная дислокация {ship_name}: {amount}")
    await self._select_planet(page, _coord_tuple(source_coord))
    await page.evaluate("() => { if (typeof showTab === 'function') showTab('TabChooseShips'); }")
    selector = f"#ship_1_{ship_id}"
    await page.locator(selector).wait_for(state="attached", timeout=10_000)
    available = int(await page.locator(selector + "_max").get_attribute("value") or 0)
    if available < amount:
        raise BrowserAutomationError(f"{move['source_name']}: доступно {available} «{ship_name}», нужно {amount}")
    await page.evaluate("""() => document.querySelectorAll('input.ships').forEach(el => {
        el.value='0'; el.dispatchEvent(new Event('change', {bubbles:true}));
    })""")
    await page.locator(selector).fill(str(amount))
    await page.locator(selector).dispatch_event("change")
    # Mission 4 is «Дислокация» in the game's own fleet form.
    await page.locator("select#mission").select_option("4")
    await page.evaluate("() => { if (typeof selectMissionImg === 'function') selectMissionImg(4); if (typeof shipsCheck === 'function') shipsCheck(); }")
    await page.locator("#TabSendFleets").wait_for(state="visible", timeout=12_000)
    timing = await self._set_target_coords(page, *_coord_tuple(target_coord))
    before = await self._read_flights_from_page(page)
    before_ids = {str(row.get("id")) for row in before if row.get("id")}
    button = page.locator("#SendFleetButton")
    if await button.is_disabled():
        raise BrowserAutomationError("Игра не разрешает эту дислокацию: проверь топливо и свободные слоты.")
    try:
        async with page.expect_response(
            lambda response: "ajax_fleets.php" in response.url and response.request.method == "POST"
            and "type=SendFleet" in (response.request.post_data or ""), timeout=15_000
        ) as response_info:
            await button.click()
        payload = json.loads(await (await response_info.value).text())
    except Exception as exc:
        await self._assert_no_captcha(page, "captcha_fleet_manager_send")
        raise BrowserAutomationError("Не получен ответ игры на дислокацию") from exc
    if str(payload.get("pass")) == "0":
        raise BrowserAutomationError(str(payload.get("info") or "Игра отклонила дислокацию"))
    deadline = time.monotonic() + 12
    verified: dict[str, Any] | None = None
    while time.monotonic() < deadline:
        await asyncio.sleep(0.45)
        await page.evaluate("() => { if (typeof showFleets === 'function') showFleets(); }")
        rows = await self._read_flights_from_page(page)
        verified = next((row for row in rows if row.get("id") and str(row["id"]) not in before_ids
                         and str(row.get("target") or "").replace(" ", "") == target_coord
                         and "дислока" in str(row.get("mission") or "").casefold()), None)
        if verified:
            break
    result = {"source": source_coord, "target": target_coord, "ship_name": ship_name, "amount": amount,
              "one_way_seconds": int(timing.get("one") or 0), "verified": bool(verified)}
    if not verified:
        raise UnverifiedSendError("Игра могла принять дислокацию, но новый рейс не подтверждён. Пакет остановлен.", result)
    return result


async def send_fleet_dislocations(self: BrowserWorker, snapshot: dict[str, Any], moves: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Send reviewed moves serially; stop immediately if a game-side check fails."""
    by_coord = {str(planet.get("coord")): planet for planet in snapshot.get("planets", [])}
    page = await self._ensure_fleets_page()
    results: list[dict[str, Any]] = []
    for move in moves:
        await self._assert_no_captcha(page, "captcha_fleet_manager_batch")
        source = by_coord.get(str(move.get("source_coord")))
        if not source:
            raise BrowserAutomationError("В снимке не найдена планета-источник дислокации")
        results.append(await _send_one_dislocation(self, page, move, dict(source.get("ships") or {})))
    return results


def install_fleet_manager_feature(app_module: Any, app_class: type[Any]) -> None:
    if getattr(app_class, "_fleet_manager_feature_installed", False):
        return
    BrowserWorker.scan_fleet_manager = scan_fleet_manager  # type: ignore[attr-defined]
    BrowserWorker.send_fleet_dislocations = send_fleet_dislocations  # type: ignore[attr-defined]
    original_build_shell = app_class._build_shell
    original_show_page = app_class.show_page
    original_render_all = app_class.render_all

    def saved_targets(self: Any) -> dict[str, dict[str, int]]:
        return {str(coord): {str(name): max(0, int(value or 0)) for name, value in dict(items or {}).items()}
                for coord, items in dict(self.settings.get(TARGETS_KEY, {}) or {}).items()}

    def saved_locks(self: Any) -> dict[str, bool]:
        return {str(coord): bool(value) for coord, value in dict(self.settings.get(LOCKS_KEY, {}) or {}).items()}

    def saved_fillers(self: Any) -> dict[str, str]:
        return {str(coord): str(name) for coord, name in dict(self.settings.get(FILLERS_KEY, {}) or {}).items() if name}

    def save_manager_settings(self: Any) -> None:
        self.settings[TARGETS_KEY] = self.fleet_manager_targets
        self.settings[LOCKS_KEY] = self.fleet_manager_locked
        self.settings[FILLERS_KEY] = self.fleet_manager_fillers
        self.db.set_setting(TARGETS_KEY, self.fleet_manager_targets)
        self.db.set_setting(LOCKS_KEY, self.fleet_manager_locked)
        self.db.set_setting(FILLERS_KEY, self.fleet_manager_fillers)

    def _apply_live_fleet_snapshot(self: Any, snapshot: dict[str, Any]) -> None:
        """Replace every planning view with one current, coordinate-safe snapshot."""
        previous = getattr(self, "fleet_manager_snapshot", None) or getattr(self, "fleet_planner_snapshot", None) or {}
        old_by_coord = {str(item.get("coord") or ""): _normal_name(str(item.get("name") or ""))
                        for item in previous.get("planets", [])}
        new_by_name: dict[str, list[str]] = defaultdict(list)
        for item in snapshot.get("planets", []):
            new_by_name[_normal_name(str(item.get("name") or ""))].append(str(item.get("coord") or ""))
        coord_migration = {
            old_coord: coords[0]
            for old_coord, name in old_by_coord.items()
            if name and len(coords := new_by_name.get(name, [])) == 1
        }
        def migrate_map(values: dict[str, Any]) -> dict[str, Any]:
            result: dict[str, Any] = {}
            for coord, value in values.items():
                result[coord_migration.get(str(coord), str(coord))] = value
            return result
        self.fleet_manager_targets = migrate_map(self.fleet_manager_targets)
        self.fleet_manager_locked = migrate_map(self.fleet_manager_locked)
        self.fleet_manager_fillers = migrate_map(self.fleet_manager_fillers)
        live_coords = {str(item.get("coord") or "").replace(" ", "") for item in snapshot.get("planets", [])}
        self.fleet_manager_targets = {
            coord: values for coord, values in self.fleet_manager_targets.items() if coord in live_coords
        }
        self.fleet_manager_locked = {
            coord: value for coord, value in self.fleet_manager_locked.items() if coord in live_coords
        }
        self.fleet_manager_fillers = {
            coord: value for coord, value in self.fleet_manager_fillers.items() if coord in live_coords
        }
        excluded = {
            str(coord).replace(" ", "")
            for coord in getattr(self, "fleet_planning_excluded_coords", self.settings.get(PLANNING_EXCLUSIONS_KEY, []))
            if str(coord).replace(" ", "") in live_coords
        }
        self.fleet_planning_excluded_coords = excluded
        self.fleet_manager_snapshot = snapshot
        self.fleet_planner_snapshot = snapshot
        self.fleet_manager_plan = None
        self.fleet_planner_plan = None
        self.settings[SNAPSHOT_KEY] = snapshot
        self.settings[PLANNING_EXCLUSIONS_KEY] = sorted(excluded)
        self.db.set_settings({
            SNAPSHOT_KEY: snapshot,
            TARGETS_KEY: self.fleet_manager_targets,
            LOCKS_KEY: self.fleet_manager_locked,
            FILLERS_KEY: self.fleet_manager_fillers,
            PLANNING_EXCLUSIONS_KEY: sorted(excluded),
        })
        if hasattr(self, "fleet_manager_planet_box"):
            refresh_selectors(self)

    def refresh_owned_planets(self: Any) -> None:
        """Refresh the live owned-planet list and all planner data behind it."""
        endpoint = self.endpoint()
        async def operation() -> dict[str, Any]:
            await self.worker.connect(endpoint)
            # Read the game switcher first.  The full scan below then reads
            # fleet, queue, hangar, resources and current construction speed.
            owned = await self.worker.read_owned_planets()  # type: ignore[attr-defined]
            snapshot = await self.worker.scan_fleet_manager()  # type: ignore[attr-defined]
            by_name: dict[str, list[str]] = defaultdict(list)
            for item in owned:
                by_name[_normal_name(str(item.get("name") or ""))].append(str(item.get("coord") or ""))
            mismatched = [
                f"{item.get('name')}: [{item.get('coord')}] → [{coords[0]}]"
                for item in snapshot.get("planets", [])
                if len(coords := by_name.get(_normal_name(str(item.get("name") or "")), [])) == 1
                and str(item.get("coord") or "") != coords[0]
            ]
            if mismatched:
                raise BrowserAutomationError(
                    "Координаты в игре изменились прямо во время считывания: " + "; ".join(mismatched)
                    + ". Повтори обновление — старый снимок не будет сохранён."
                )
            return snapshot
        def success(snapshot: dict[str, Any]) -> None:
            self.connected = True
            _apply_live_fleet_snapshot(self, snapshot)
            refresh_selectors(self)
            self.render_all()
            message = f"Обновлено: {len(snapshot['planets'])} своих планет и их координаты. Старые координаты больше не используются."
            self.fleet_manager_status_var.set(message)
            if hasattr(self, "planner_status_var"):
                self.planner_status_var.set(message)
        self.run_task(operation(), "Обновление своих планет, координат и флота…", success)

    def build_page(self: Any) -> None:
        tk, ttk = app_module.tk, app_module.ttk
        page = self._new_page("fleet_manager")
        style = ttk.Style(self)
        style.configure("FleetManager.Treeview", background=app_module.PANEL, fieldbackground=app_module.PANEL,
                        foreground=app_module.TEXT, rowheight=40, borderwidth=0, font=("Segoe UI", 9))
        style.configure("FleetManager.Treeview.Heading", background=app_module.PANEL_ALT, foreground=app_module.MUTED,
                        relief="flat", font=("Segoe UI Semibold", 9), padding=(9, 9))
        style.map("FleetManager.Treeview", background=[("selected", app_module.ACCENT)], foreground=[("selected", app_module.TEXT)])
        style.configure("FleetManager.TCombobox", fieldbackground=app_module.INPUT, background=app_module.INPUT,
                        foreground=app_module.TEXT, arrowcolor=app_module.TEXT, bordercolor=app_module.BORDER)
        style.map("FleetManager.TCombobox", fieldbackground=[("readonly", app_module.INPUT)],
                  foreground=[("readonly", app_module.TEXT)], selectforeground=[("readonly", app_module.TEXT)],
                  selectbackground=[("readonly", app_module.INPUT)])
        self.option_add("*TCombobox*Listbox.background", app_module.INPUT)
        self.option_add("*TCombobox*Listbox.foreground", app_module.TEXT)
        self.option_add("*TCombobox*Listbox.selectBackground", app_module.ACCENT)
        self.option_add("*TCombobox*Listbox.selectForeground", app_module.TEXT)
        toolbar = tk.Frame(page, bg=app_module.BG)
        toolbar.pack(fill="x", pady=(0, 12))
        app_module.make_button(toolbar, "Считать флот из игры", self.fleet_manager_scan, "primary").pack(side="left")
        app_module.make_button(toolbar, "Перепроверить", self.fleet_manager_scan, "secondary").pack(side="left", padx=8)
        self.fleet_manager_send_button = app_module.make_button(toolbar, "Запустить дислокации", self.fleet_manager_send, "ghost")
        self.fleet_manager_send_button.pack(side="right")
        self.fleet_manager_calculate_button = app_module.make_button(toolbar, "Рассчитать дислокации", self.fleet_manager_calculate, "primary")
        self.fleet_manager_calculate_button.pack(side="right", padx=(0, 8))

        summary = tk.Frame(page, bg=app_module.BG)
        summary.pack(fill="x", pady=(0, 10))
        self.fleet_manager_snapshot_var = tk.StringVar(value="Нет снимка")
        self.fleet_manager_goals_var = tk.StringVar(value="0 целей")
        self.fleet_manager_free_var = tk.StringVar(value="—")
        for index, (title, variable) in enumerate((("СОСТОЯНИЕ ФЛОТА", self.fleet_manager_snapshot_var),
                                                    ("ЦЕЛИ РАСПРЕДЕЛЕНИЯ", self.fleet_manager_goals_var),
                                                    ("СВОБОДНЫЙ АНГАР", self.fleet_manager_free_var))):
            summary.grid_columnconfigure(index, weight=1)
            card = tk.Frame(summary, bg=app_module.PANEL_ALT, padx=14, pady=10, highlightbackground=app_module.BORDER, highlightthickness=1)
            card.grid(row=0, column=index, sticky="ew", padx=(0 if index == 0 else 6, 0))
            tk.Label(card, text=title, bg=app_module.PANEL_ALT, fg=app_module.MUTED, font=("Segoe UI Semibold", 8)).pack(anchor="w")
            tk.Label(card, textvariable=variable, bg=app_module.PANEL_ALT, fg=app_module.TEXT, font=("Segoe UI Semibold", 10)).pack(anchor="w", pady=(4, 0))

        editor = tk.Frame(page, bg=app_module.PANEL, padx=16, pady=12, highlightbackground=app_module.BORDER, highlightthickness=1)
        editor.pack(fill="x", pady=(0, 10))
        tk.Label(editor, text="Цель флота на планете", bg=app_module.PANEL, fg=app_module.TEXT, font=("Segoe UI Semibold", 10)).grid(row=0, column=0, columnspan=5, sticky="w")
        tk.Label(editor, text="Планета", bg=app_module.PANEL, fg=app_module.MUTED).grid(row=1, column=0, sticky="w", pady=(8, 0))
        self.fleet_manager_planet_var = tk.StringVar()
        self.fleet_manager_planet_box = ttk.Combobox(editor, textvariable=self.fleet_manager_planet_var, state="readonly", width=25,
                                                     style="FleetManager.TCombobox")
        self.fleet_manager_planet_box.grid(row=2, column=0, sticky="w", padx=(0, 12))
        tk.Label(editor, text="Корабль", bg=app_module.PANEL, fg=app_module.MUTED).grid(row=1, column=1, sticky="w", pady=(8, 0))
        self.fleet_manager_ship_var = tk.StringVar()
        self.fleet_manager_ship_box = ttk.Combobox(editor, textvariable=self.fleet_manager_ship_var, state="readonly", width=28,
                                                   style="FleetManager.TCombobox")
        self.fleet_manager_ship_box.grid(row=2, column=1, sticky="w", padx=(0, 12))
        tk.Label(editor, text="Должно быть", bg=app_module.PANEL, fg=app_module.MUTED).grid(row=1, column=2, sticky="w", pady=(8, 0))
        self.fleet_manager_goal_var = tk.IntVar(value=0)
        tk.Spinbox(editor, from_=0, to=1_000_000, textvariable=self.fleet_manager_goal_var, width=11,
                   bg=app_module.INPUT, fg=app_module.TEXT, insertbackground=app_module.TEXT).grid(row=2, column=2, sticky="w", padx=(0, 12))
        app_module.make_button(editor, "Сохранить цель", self.fleet_manager_save_target, "primary").grid(row=2, column=3, sticky="w")
        app_module.make_button(editor, "Убрать цель", self.fleet_manager_clear_target, "ghost").grid(row=2, column=4, sticky="w", padx=(8, 0))
        tk.Label(editor, text="Заполнить остаток ангара", bg=app_module.PANEL, fg=app_module.MUTED).grid(row=3, column=0, sticky="w", pady=(10, 0))
        self.fleet_manager_filler_var = tk.StringVar()
        self.fleet_manager_filler_box = ttk.Combobox(editor, textvariable=self.fleet_manager_filler_var, state="readonly", width=28,
                                                     style="FleetManager.TCombobox")
        self.fleet_manager_filler_box.grid(row=4, column=0, sticky="w", padx=(0, 12))
        app_module.make_button(editor, "Сохранить заполнение", self.fleet_manager_save_filler, "secondary").grid(row=4, column=1, sticky="w")
        app_module.make_button(editor, "Без заполнителя", self.fleet_manager_clear_filler, "ghost").grid(row=4, column=2, sticky="w", padx=(8, 0))
        self.fleet_manager_lock_var = tk.BooleanVar(value=False)
        tk.Checkbutton(editor, text="Не брать флот с этой планеты", variable=self.fleet_manager_lock_var,
                       command=self.fleet_manager_save_lock, bg=app_module.PANEL, fg=app_module.TEXT,
                       activebackground=app_module.PANEL, activeforeground=app_module.TEXT,
                       selectcolor=app_module.PANEL_ALT).grid(row=5, column=0, columnspan=3, sticky="w", pady=(10, 0))
        tk.Label(editor, text="Защищённая планета может принимать флот, но никогда не становится источником автоматического сбора.",
                 bg=app_module.PANEL, fg=app_module.MUTED, font=("Segoe UI", 8)).grid(row=6, column=0, columnspan=5, sticky="w", pady=(4, 0))
        self.fleet_manager_planet_box.bind("<<ComboboxSelected>>", lambda _event: self.fleet_manager_load_selection())
        self.fleet_manager_ship_box.bind("<<ComboboxSelected>>", lambda _event: self.fleet_manager_load_selection())

        self.fleet_manager_status_var = tk.StringVar(value="Считай флот: снимок сохранится и будет доступен после перезапуска программы.")
        tk.Label(page, textvariable=self.fleet_manager_status_var, bg=app_module.PANEL_ALT, fg=app_module.MUTED,
                 anchor="w", padx=14, pady=9, font=("Segoe UI", 9)).pack(fill="x", pady=(0, 10))
        tk.Label(page, text="Флот, очередь и ангар по планетам", bg=app_module.BG, fg=app_module.TEXT, font=("Segoe UI Semibold", 10)).pack(anchor="w", pady=(0, 4))
        self.fleet_manager_tree = ttk.Treeview(page, columns=("hangar", "ideal", "actual", "queue", "missing", "state"), show="tree headings", style="FleetManager.Treeview", height=12)
        self.fleet_manager_tree.heading("#0", text="Планета / корабль"); self.fleet_manager_tree.column("#0", width=230, minwidth=230, anchor="w")
        for key, title, width in (("hangar", "Ангар", 165), ("ideal", "Идеал", 100), ("actual", "Есть", 100),
                                  ("queue", "Строится", 105), ("missing", "Построить", 110), ("state", "Статус", 220)):
            self.fleet_manager_tree.heading(key, text=title); self.fleet_manager_tree.column(key, width=width, minwidth=width, anchor="w")
        self.fleet_manager_tree.pack(fill="x", pady=(0, 10))
        tk.Label(page, text="План дислокаций", bg=app_module.BG, fg=app_module.TEXT, font=("Segoe UI Semibold", 10)).pack(anchor="w", pady=(0, 4))
        self.fleet_manager_moves_tree = ttk.Treeview(page, columns=("from", "to", "ship", "amount", "hangar"), show="headings", style="FleetManager.Treeview", height=7)
        for key, title, width in (("from", "Откуда", 180), ("to", "Куда", 180), ("ship", "Корабль", 250), ("amount", "Перевести", 105), ("hangar", "Свободно после плана", 210)):
            self.fleet_manager_moves_tree.heading(key, text=title); self.fleet_manager_moves_tree.column(key, width=width, minwidth=width, anchor="w")
        self.fleet_manager_moves_tree.pack(fill="both", expand=True)

    def refresh_selectors(self: Any) -> None:
        snapshot = self.fleet_manager_snapshot or {}
        planets = snapshot.get("planets", [])
        planet_values = [f"{item.get('name')} [{item.get('coord')}]" for item in planets]
        ship_names = sorted({name for item in planets for name in (item.get("ships") or {})})
        self.fleet_manager_planet_box.configure(values=planet_values)
        self.fleet_manager_ship_box.configure(values=ship_names)
        self.fleet_manager_filler_box.configure(values=ship_names)
        if planet_values and self.fleet_manager_planet_var.get() not in planet_values:
            self.fleet_manager_planet_var.set(planet_values[0])
        if ship_names and self.fleet_manager_ship_var.get() not in ship_names:
            self.fleet_manager_ship_var.set(ship_names[0])
        load_selection(self)

    def selected_coord(self: Any) -> str:
        value = self.fleet_manager_planet_var.get()
        return value.rsplit("[", 1)[-1].rstrip("]").strip() if "[" in value else ""

    def load_selection(self: Any) -> None:
        coord, ship = selected_coord(self), self.fleet_manager_ship_var.get()
        self.fleet_manager_goal_var.set(int((self.fleet_manager_targets.get(coord, {}) or {}).get(ship, 0))
                                        if coord and ship else 0)
        self.fleet_manager_lock_var.set(bool(self.fleet_manager_locked.get(coord, False)))
        self.fleet_manager_filler_var.set(self.fleet_manager_fillers.get(coord, ""))

    def save_target(self: Any) -> None:
        coord, ship = selected_coord(self), self.fleet_manager_ship_var.get()
        if not coord or not ship:
            return
        goal = max(0, int(self.fleet_manager_goal_var.get() or 0))
        if goal:
            self.fleet_manager_targets.setdefault(coord, {})[ship] = goal
        else:
            self.fleet_manager_targets.get(coord, {}).pop(ship, None)
        save_manager_settings(self)
        render_manager(self)
        self.fleet_manager_status_var.set(f"Цель сохранена: {ship} × {goal} на {coord}.")

    def clear_target(self: Any) -> None:
        coord, ship = selected_coord(self), self.fleet_manager_ship_var.get()
        if coord and ship:
            self.fleet_manager_targets.get(coord, {}).pop(ship, None)
            if not self.fleet_manager_targets.get(coord):
                self.fleet_manager_targets.pop(coord, None)
            save_manager_settings(self); load_selection(self); render_manager(self)

    def save_filler(self: Any) -> None:
        coord, ship = selected_coord(self), self.fleet_manager_filler_var.get()
        if coord and ship:
            self.fleet_manager_fillers[coord] = ship
            save_manager_settings(self); render_manager(self)

    def clear_filler(self: Any) -> None:
        coord = selected_coord(self)
        if coord:
            self.fleet_manager_fillers.pop(coord, None)
            save_manager_settings(self); load_selection(self); render_manager(self)

    def save_lock(self: Any) -> None:
        coord = selected_coord(self)
        if coord:
            self.fleet_manager_locked[coord] = bool(self.fleet_manager_lock_var.get())
            save_manager_settings(self); render_manager(self)

    def render_manager(self: Any) -> None:
        if not hasattr(self, "fleet_manager_tree"):
            return
        snapshot = self.fleet_manager_snapshot or {}
        for tree in (self.fleet_manager_tree, self.fleet_manager_moves_tree):
            for item in tree.get_children(): tree.delete(item)
        planets = snapshot.get("planets", [])
        excluded = set(getattr(self, "fleet_planning_excluded_coords", self.settings.get(PLANNING_EXCLUSIONS_KEY, [])))
        readiness = calculate_fleet_readiness(snapshot, self.fleet_manager_targets, self.fleet_manager_fillers, excluded)
        self.fleet_manager_readiness = readiness
        total_free = 0
        for planet in planets:
            coord = str(planet.get("coord")); hangar = planet.get("hangar") or {}
            free = max(0, int(hangar.get("free") or 0)); total = max(0, int(hangar.get("total") or 0)); used = max(0, int(hangar.get("used") or 0)); total_free += 0 if coord in excluded else free
            rows = readiness["rows_by_coord"].get(coord, [])
            missing = sum(int(row["missing"]) for row in rows)
            paused = coord in excluded
            parent = self.fleet_manager_tree.insert("", "end", text=f"{planet.get('name')} [{coord}]", open=False, values=(
                f"{_short(used)} / {_short(total)}\nсвоб. {_short(free)}", "", "", "",
                f"{_short(missing)}" if missing else "—", "ИСКЛЮЧЕНА ИЗ РАСЧЁТА" if paused else
                ("НЕ ТРОГАТЬ" if self.fleet_manager_locked.get(coord, False) else "готов к плану")))
            for row in rows:
                state = "готово" if not row["missing"] else f"не хватает {_short(row['missing'])}"
                if row["is_filler"]: state += " · заполнитель"
                self.fleet_manager_tree.insert(parent, "end", text=row["ship_name"], values=(
                    f"вес {row['weight']}", _short(row["target"]), _short(row["actual"]), _short(row["queued"]),
                    _short(row["missing"]) if row["missing"] else "—", state))
        captured = snapshot.get("captured_at")
        self.fleet_manager_snapshot_var.set(f"{len(planets)} планет · {captured[11:16] if captured else 'нет снимка'}")
        goal_count = sum(len(items) for items in self.fleet_manager_targets.values())
        to_build = " · ".join(f"{name}: {_short(amount)}" for name, amount in sorted(readiness["requirements_by_ship"].items())) or "всё укомплектовано"
        self.fleet_manager_goals_var.set(f"построить: {to_build}")
        self.fleet_manager_free_var.set(f"{_short(total_free)} свободно")
        plan = self.fleet_manager_plan
        if plan:
            by_coord = {str(item.get("coord")): item for item in planets}
            for move in plan["moves"]:
                target = by_coord.get(move["target_coord"], {})
                total = int((target.get("hangar") or {}).get("total") or 0)
                after_free = plan["projected_free"].get(move["target_coord"], 0)
                self.fleet_manager_moves_tree.insert("", "end", values=(move["source_name"], move["target_name"], move["ship_name"],
                    f"{_short(move['amount'])} шт.", f"свободно {_short(after_free)} из {_short(total)}"))
            for problem in plan["unresolved"]:
                self.fleet_manager_moves_tree.insert("", "end", values=("—", problem["name"], problem["ship_name"],
                    f"не хватает {_short(problem['amount'])}", problem["reason"]))
        self.fleet_manager_send_button.configure(state="normal" if plan and plan.get("moves") else "disabled")

    def manager_scan(self: Any) -> None:
        endpoint = self.endpoint()
        async def operation() -> dict[str, Any]:
            await self.worker.connect(endpoint)
            return await self.worker.scan_fleet_manager()  # type: ignore[attr-defined]
        def success(snapshot: dict[str, Any]) -> None:
            self.connected = True; _apply_live_fleet_snapshot(self, snapshot)
            refresh_selectors(self); self.render_all()
            self.fleet_manager_status_var.set(f"Снимок сохранён: {len(snapshot['planets'])} планет, флот и лимиты ангара обновлены.")
        self.run_task(operation(), "Считывание флота и вместимости ангаров…", success)

    def manager_calculate(self: Any) -> None:
        if not self.fleet_manager_snapshot:
            app_module.messagebox.showinfo(app_module.APP_NAME, "Сначала нажми «Считать флот из игры»."); return
        excluded = set(getattr(self, "fleet_planning_excluded_coords", self.settings.get(PLANNING_EXCLUSIONS_KEY, [])))
        readiness = calculate_fleet_readiness(self.fleet_manager_snapshot, self.fleet_manager_targets, self.fleet_manager_fillers, excluded)
        self.fleet_manager_readiness = readiness
        self.settings[BUILD_REQUIREMENTS_KEY] = readiness["requirements"]
        self.db.set_setting(BUILD_REQUIREMENTS_KEY, readiness["requirements"])
        self.fleet_manager_plan = calculate_dislocation_plan(
            self.fleet_manager_snapshot, readiness["targets"], self.fleet_manager_locked, excluded,
        )
        plan = self.fleet_manager_plan
        self.fleet_manager_status_var.set(
            f"План сохранён: построить {sum(readiness['requirements_by_ship'].values())} кораблей; "
            f"дислокаций: {len(plan['moves'])}." + (f" Не закрыто целей: {len(plan['unresolved'])}." if plan["unresolved"] else " Все цели закрываются.")
        )
        render_manager(self)

    def manager_send(self: Any) -> None:
        plan = self.fleet_manager_plan
        if not plan or not plan.get("moves"):
            return
        if not app_module.messagebox.askyesno(
            app_module.APP_NAME,
            f"Запустить {len(plan['moves'])} дислокаций?\n\nПеред каждым рейсом игра проверит доступный флот, топливо и слоты. "
            "При первой ошибке отправка остановится. После выполнения обязательно перепроверь флот.",
        ):
            return
        endpoint = self.endpoint(); snapshot = self.fleet_manager_snapshot
        async def operation() -> list[dict[str, Any]]:
            await self.worker.connect(endpoint)
            return await self.worker.send_fleet_dislocations(snapshot, plan["moves"])  # type: ignore[attr-defined]
        def success(results: list[dict[str, Any]]) -> None:
            self.fleet_manager_plan = None; render_manager(self)
            self.fleet_manager_status_var.set(f"Подтверждено дислокаций: {len(results)}. Нажми «Перепроверить» после прибытия флотов.")
            self.status_var.set("Дислокации отправлены")
        def error(exc: Exception) -> None:
            self.fleet_manager_plan = None; render_manager(self)
            self.fleet_manager_status_var.set(f"Дислокации остановлены: {exc}")
            app_module.messagebox.showerror(app_module.APP_NAME, str(exc))
        self.run_task(operation(), "Отправка дислокаций…", success, error)

    def patched_build_shell(self: Any) -> None:
        original_build_shell(self)
        queue_button = self.nav_buttons["queue"]; nav_group = queue_button.master.master
        base_bg, active_bg = str(queue_button.cget("bg")), str(queue_button.cget("activebackground"))
        base_fg, active_fg = str(queue_button.cget("fg")), str(queue_button.cget("activeforeground"))
        row = app_module.tk.Frame(nav_group, bg=base_bg); row.pack(fill="x", padx=10, pady=2, before=queue_button.master)
        rail = app_module.tk.Frame(row, bg=base_bg, width=3, height=31); rail.pack(side="left", fill="y")
        button = app_module.tk.Button(row, text="◇  План флота", anchor="w", command=lambda: self.show_page("fleet_manager"),
            bg=base_bg, fg=base_fg, activebackground=active_bg, activeforeground=active_fg, relief="flat", bd=0,
            padx=14, pady=9, cursor="hand2", highlightthickness=0, font=queue_button.cget("font"))
        button.pack(side="left", fill="x", expand=True); setattr(button, "_nav_rail", rail)
        self._fleet_manager_nav_colors = (base_bg, active_bg, base_fg, active_fg)
        self.nav_buttons["fleet_manager"] = button
        self.fleet_manager_targets = saved_targets(self); self.fleet_manager_locked = saved_locks(self); self.fleet_manager_fillers = saved_fillers(self)
        self.fleet_planning_excluded_coords = {
            str(coord).replace(" ", "") for coord in self.settings.get(PLANNING_EXCLUSIONS_KEY, []) if str(coord).strip()
        }
        self.fleet_manager_snapshot = self.settings.get(SNAPSHOT_KEY) or None
        self.fleet_manager_plan = None
        build_page(self)
        if self.fleet_manager_snapshot: refresh_selectors(self)

    def patched_show_page(self: Any, key: str) -> None:
        if key != "fleet_manager":
            return original_show_page(self, key)
        self.current_page = key; self.page_title_var.set("План флота")
        self.pages[key].tkraise()
        base_bg, active_bg, base_fg, active_fg = self._fleet_manager_nav_colors
        for nav_key, button in self.nav_buttons.items():
            selected = nav_key == key
            button.configure(bg=active_bg if selected else base_bg, fg=active_fg if selected else base_fg)
            rail = getattr(button, "_nav_rail", None)
            if rail is not None: rail.configure(bg=app_module.ACCENT if selected else base_bg)
        render_manager(self)

    def patched_render_all(self: Any) -> None:
        original_render_all(self); render_manager(self)

    app_class.fleet_manager_scan = manager_scan
    app_class.refresh_owned_planets = refresh_owned_planets
    app_class._apply_live_fleet_snapshot = _apply_live_fleet_snapshot
    app_class.fleet_manager_calculate = manager_calculate
    app_class.fleet_manager_send = manager_send
    app_class.fleet_manager_save_target = save_target
    app_class.fleet_manager_clear_target = clear_target
    app_class.fleet_manager_save_filler = save_filler
    app_class.fleet_manager_clear_filler = clear_filler
    app_class.fleet_manager_save_lock = save_lock
    app_class.fleet_manager_load_selection = load_selection
    app_class._build_shell = patched_build_shell
    app_class.show_page = patched_show_page
    app_class.render_all = patched_render_all
    app_class._fleet_manager_feature_installed = True
