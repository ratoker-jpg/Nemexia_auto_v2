"""Battle-advisor page: counter-fleets from reports and permanent planet fleets."""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import replace
from typing import Any
from uuid import uuid4

from browser import BrowserAutomationError, BrowserWorker
from battle_catalog import BLUE_FLEET, BY_NAME, COMMANDER_SLOTS, ENEMY_FLEET
from battle_campaign import (
    RACE_LABELS, build_verification_campaign, campaign_manifest, write_campaign_manifest,
)
from battle_engine import CounterPlan, EnemyScan, parse_enemy_scan, recommend_planet_fleets
from battle_simulator import (
    SimulatorResult, SimulatorScenario, build_planet_candidates, build_planet_scenarios, build_simulator_candidates,
    catalog_for_race, fit_candidate_population, parse_report_summary, rank_planet_trials, rank_simulator_results,
)
from page_capture import capture_page
from battle_simulation_log import append_trial, load_planet_cache, load_recent_trials, save_planet_cache
from config import DATA_DIR, FLEETS_URL


# Verification runs are clean-room comparisons.  The former hidden +7.5 pp
# defender equipment margin made reports disagree with the visible form.
DEFENDER_EQUIPMENT_MARGIN_PP = 0.0


RACE_IDS = {"Синяя": 1, "Зелёная": 2, "Красная": 3}
RACE_SELECTION_IDS = {"Конфедерация": 1, "Тертеты": 2, "Ноксы": 3}
BATTLE_ARCHIVE_DIR = DATA_DIR / "simulation-battles" / "reports"
CAMPAIGN_ARCHIVE_DIR = DATA_DIR / "simulation-battles" / "campaigns"


def _safe_page_url(page: Any) -> str:
    """Read a Playwright page URL even when a popup has already closed."""
    if page is None:
        return ""
    try:
        return str(page.url)
    except Exception:
        return ""


def _scan_race_id(scan: EnemyScan, preferred_race_id: int | None = None) -> int:
    """Resolve the simulator race, honouring an explicit user choice.

    ``BY_NAME`` is intentionally a convenience lookup, but its single value
    for the shared name «Бомбардировщик» is the red-race version.  It must not
    override the race selected by the user when every recognised hull is valid
    for that selected race.
    """
    names_by_race = {
        1: {ship.name for ship in BLUE_FLEET},
        2: {ship.name for ship in ENEMY_FLEET if ship.race == "Зелёная"},
        3: {ship.name for ship in ENEMY_FLEET if ship.race == "Красная"},
    }
    combat_names = {name for name in scan.ships if name in BY_NAME}
    if preferred_race_id in names_by_race and combat_names <= names_by_race[preferred_race_id]:
        return int(preferred_race_id)
    possible = {race_id for race_id, names in names_by_race.items() if combat_names <= names}
    if len(possible) != 1:
        raise ValueError(
            "В разведке должна быть одна раса. Добавь корабль с уникальным названием этой расы "
            "или убери строки другой расы."
        )
    return next(iter(possible))


def _normalise_scenario_commanders(scenario: SimulatorScenario) -> SimulatorScenario:
    """Keep commander hulls out of the regular-ship simulator fields.

    Reports expose all surviving hulls in one ``.ships`` group.  The game,
    however, renders commanders in separate select controls.  Normalising at
    this boundary makes a residual report safe even if a parser ever returns a
    commander in ``ships``.
    """
    ships = dict(scenario.ships)
    commanders = dict(scenario.commanders)
    for name in tuple(ships):
        if name not in COMMANDER_SLOTS:
            continue
        count = max(0, int(ships.pop(name) or 0))
        existing = commanders.get(name)
        previous_count = int(existing[0]) if existing else 0
        level = int(existing[1]) if existing else int(scenario.levels.get(name, 10))
        if max(count, previous_count):
            commanders[name] = (max(count, previous_count), max(0, level))
    return SimulatorScenario(
        scenario.title, scenario.race_id, ships, dict(scenario.levels),
        commanders, dict(scenario.defence),
    )


_SIMULATOR_FORM_STATE_JS = r"""() => {
    const form = document.querySelector('#simulatorForm');
    if (!form) return {url: location.href, fields: {}};
    const fields = {};
    form.querySelectorAll('input, select, textarea').forEach(el => {
        if (!el.id && !el.name) return;
        const key = el.id || el.name;
        fields[key] = {
            id: el.id || '', name: el.name || '', type: el.type || el.tagName.toLowerCase(),
            value: el.value ?? '', checked: el.type === 'checkbox' ? !!el.checked : null,
            selectedText: el.tagName.toLowerCase() === 'select'
                ? (el.selectedOptions[0]?.textContent || '').trim() : '',
        };
    });
    const value = id => document.getElementById(id)?.value ?? '';
    return {
        url: location.href,
        attackerRaceId: Number(value('choose_race1') || 0),
        defenderRaceId: Number(value('choose_race2') || 0),
        rounds: Number(form.querySelector('select[name="battleRounds"]')?.value || 0),
        fields,
    };
}"""


def _normalise_live_catalogs(payload: dict[str, Any]) -> tuple[dict[int, dict[str, Any]], dict[int, dict[str, Any]]]:
    """Convert JavaScript's numeric object keys into Python integer keys."""
    def normalise(raw: Any) -> dict[int, dict[str, Any]]:
        if not isinstance(raw, dict):
            return {}
        result: dict[int, dict[str, Any]] = {}
        for key, value in raw.items():
            try:
                result[int(key)] = dict(value) if isinstance(value, dict) else {}
            except (TypeError, ValueError):
                continue
        return result
    return normalise(payload.get("raceShips")), normalise(payload.get("raceDefence"))


async def _expand_report_analysis(report: Any) -> dict[str, Any]:
    """Open every round's «Анализ» disclosure before the page is captured."""
    result = await report.evaluate(r"""() => {
        const links = [...document.querySelectorAll('.detailedReport a')];
        const rounds = [];
        let clicked = 0;
        for (const link of links) {
            const onclick = link.getAttribute('onclick') || '';
            const match = onclick.match(/#([A-Za-z0-9_-]+)/);
            const target = match ? document.getElementById(match[1]) : link.parentElement?.nextElementSibling;
            if (!target) continue;
            const id = target.id || '';
            rounds.push(id);
            const hidden = getComputedStyle(target).display === 'none' || target.style.display === 'none';
            if (hidden) {
                link.click();
                clicked += 1;
            }
        }
        const hidden = rounds.filter(id => {
            const target = id ? document.getElementById(id) : null;
            return target && getComputedStyle(target).display === 'none';
        });
        return {links: links.length, clicked, rounds, hidden};
    }""")
    # jQuery's toggle is synchronous, but the short yield lets the browser
    # commit style/layout changes before full_page screenshots are taken.
    await report.wait_for_timeout(120)
    return dict(result or {})


async def _run_verification_campaign(
    worker: BrowserWorker,
    *,
    progress: Callable[[int, int, str], None] | None = None,
    rounds: int = 12,
) -> dict[str, Any]:
    """Run the assistant-controlled discovery pack and archive every report.

    This path deliberately does not use the compact counter/top-7 ranking
    flow.  It submits one explicit case at a time, zeros every science/skill/
    stat/equipment field, expands every report round and stores the exact
    effective form state alongside the HTML/PNG/MHTML artefacts.
    """
    page = await worker._ensure_fleets_page()
    await worker._assert_no_captcha(page, "captcha_verification_campaign")
    if not await page.locator("#simulatorForm").count():
        raise BrowserAutomationError("На странице «Полёты» не найдена форма симулятора")
    simulator = page
    async with simulator.expect_response(
        lambda response: "ajax_fleets.php" in response.url and response.request.method == "POST",
        timeout=30_000,
    ):
        await simulator.evaluate("""() => {
            if (typeof simulatorLoadData === 'function') simulatorLoadData();
            if (typeof showTab === 'function') showTab('TabSimulator');
        }""")
    await simulator.locator("#simulatorForm").wait_for(state="attached", timeout=15_000)
    # jQuery runs the simulatorLoadData callback after the response event; let
    # that callback populate commander names before we construct the pack.
    await simulator.wait_for_timeout(250)
    live = await simulator.evaluate("""() => ({
        attackerRaceId: Number(document.querySelector('#choose_race1')?.value || 0),
        raceShips: window.raceShips || {}, raceDefence: window.raceDefence || {},
        commanderNames: [...document.querySelectorAll('[id^="attackerCommanderShipName-"]')]
            .map(el => (el.textContent || '').trim()).filter(Boolean),
    })""")
    live = dict(live or {})
    attacker_race_id = int(live.get("attackerRaceId") or 0)
    if attacker_race_id not in (1, 2, 3):
        raise BrowserAutomationError("Не удалось определить автоматически выбранную расу атакующего")
    race_ships, race_defence = _normalise_live_catalogs(live)
    commander_names = [str(name) for name in (live.get("commanderNames") or []) if str(name).strip()]
    cases = build_verification_campaign(
        attacker_race_id, race_ships, race_defence, rounds=rounds,
        commander_names=commander_names,
    )
    run_id = uuid4().hex[:12]
    run_dir = CAMPAIGN_ARCHIVE_DIR / run_id
    report_root = BATTLE_ARCHIVE_DIR / run_id
    initial_form = await simulator.evaluate(_SIMULATOR_FORM_STATE_JS)
    manifest = campaign_manifest(
        run_id=run_id, attacker_race_id=attacker_race_id, cases=cases, rounds=rounds,
    )
    manifest["source_form_state"] = initial_form
    manifest["available_commanders"] = commander_names
    manifest["report_root"] = str(report_root)
    manifest.update({"status": "planned", "completed": 0, "failed": 0, "failures": []})
    manifest_path = write_campaign_manifest(run_dir / "manifest.json", manifest)

    total = len(cases)
    completed = 0
    failed = 0
    failures: list[dict[str, str]] = []
    results: list[dict[str, Any]] = []
    for index, case in enumerate(cases, start=1):
        await worker._assert_no_captcha(page, "captcha_verification_campaign_batch")
        applied: dict[str, Any] | None = None
        effective_form: dict[str, Any] | None = None
        report = None
        report_url = ""
        artifact: dict[str, str] | None = None
        analysis: dict[str, Any] = {}
        body = ""
        winner, attacker_population, defender_population, report_rounds = "Не определён", None, None, 0
        error_text = ""
        payload = {
            "attackerRaceId": attacker_race_id,
            "case": case.to_dict(),
            "commanderSlots": COMMANDER_SLOTS,
        }
        try:
            applied = await simulator.evaluate(r"""data => {
                const form = document.querySelector('#simulatorForm');
                if (!form) throw new Error('Форма симулятора не найдена');
                const normal = value => String(value || '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ');
                const set = (id, value) => {
                    const el = document.getElementById(id);
                    if (!el) return false;
                    if (el.type === 'checkbox') {
                        el.checked = Number(value) > 0;
                        // The legacy game's simulatorGetPop reads the boolean
                        // shield state through jQuery .attr('checked').
                        if (el.checked) el.setAttribute('checked', 'checked');
                        else el.removeAttribute('checked');
                    }
                    else el.value = String(value ?? '');
                    el.dispatchEvent(new Event('input', {bubbles: true}));
                    el.dispatchEvent(new Event('change', {bubbles: true}));
                    return true;
                };
                const clear = selector => [...form.querySelectorAll(selector)].forEach(el => {
                    if (el.type === 'checkbox') {
                        el.checked = false;
                        el.removeAttribute('checked');
                    }
                    else if (el.tagName.toLowerCase() === 'select') set(el.id, 0);
                    else set(el.id, 0);
                });
                set('choose_race1', data.attackerRaceId);
                set('choose_race2', data.case.defender_race_id);
                if (typeof simulatorChangeNames === 'function') simulatorChangeNames();
                clear('[id^="attackerShipCount-"], [id^="defenderShipCount-"], [id^="attackerShipLevel-"], [id^="defenderShipLevel-"], [id^="defenderDefenceCount-"]');
                clear('[id^="attackerCommanderShipCount-"], [id^="defenderCommanderShipCount-"], [id^="attackerCommanderShipLevel-"], [id^="defenderCommanderShipLevel-"]');
                clear('[id^="attackerScienceLevel-"], [id^="defenderScienceLevel-"], [id^="attackerAbilityLevel-"], [id^="defenderAbilityLevel-"], [id^="attackerAdmiralEquipmentValue-"], [id^="defenderAdmiralEquipmentValue-"]');
                const slotsFromGame = source => Object.fromEntries(
                    Object.entries(source || {}).map(([slot, item]) => [normal(item?.name), Number(slot)])
                );
                const attackerSlots = slotsFromGame(window.raceShips?.[data.attackerRaceId]);
                const defenderSlots = slotsFromGame(window.raceShips?.[data.case.defender_race_id]);
                const defenceSlots = slotsFromGame(window.raceDefence?.[data.case.defender_race_id]);
                const missing = {attackerShips: [], defenderShips: [], defence: [], commanders: []};
                Object.entries(data.case.attacker_ships || {}).forEach(([name, count]) => {
                    const slot = attackerSlots[normal(name)];
                    if (!slot) { missing.attackerShips.push(name); return; }
                    set(`attackerShipCount-${slot}`, count);
                    set(`attackerShipLevel-${slot}`, data.case.attacker_levels?.[name] ?? 10);
                });
                Object.entries(data.case.defender_ships || {}).forEach(([name, count]) => {
                    const slot = defenderSlots[normal(name)];
                    if (!slot) { missing.defenderShips.push(name); return; }
                    set(`defenderShipCount-${slot}`, count);
                    set(`defenderShipLevel-${slot}`, data.case.defender_levels?.[name] ?? 10);
                });
                Object.entries(data.case.defender_defence || {}).forEach(([name, count]) => {
                    const slot = defenceSlots[normal(name)];
                    if (!slot) { missing.defence.push(name); return; }
                    set(`defenderDefenceCount-${slot}`, count);
                });
                Object.entries(data.case.attacker_commanders || {}).forEach(([name, values]) => {
                    const slot = data.commanderSlots[name];
                    if (!slot) { missing.commanders.push(name); return; }
                    set(`attackerCommanderShipCount-${slot}`, values[0]);
                    set(`attackerCommanderShipLevel-${slot}`, values[1]);
                });
                Object.entries(data.case.defender_commanders || {}).forEach(([name, values]) => {
                    const slot = data.commanderSlots[name];
                    if (!slot) { missing.commanders.push(name); return; }
                    set(`defenderCommanderShipCount-${slot}`, values[0]);
                    set(`defenderCommanderShipLevel-${slot}`, values[1]);
                });
                const selectLead = (id, name) => {
                    const select = document.getElementById(id);
                    if (!select) return !name;
                    if (!name) { set(id, ''); return true; }
                    const target = [...select.options].find(option =>
                        normal(option.textContent) === normal(name) || normal(option.value) === normal(name)
                    );
                    if (!target) return false;
                    set(id, target.value);
                    return true;
                };
                const attackerLeadSet = selectLead('attackerLeadCommander', data.case.attacker_lead || '');
                const defenderLeadSet = selectLead('defenderLeadCommander', data.case.defender_lead || '');
                set('battle_rounds', data.case.rounds || 12);
                const battleRounds = form.querySelector('select[name="battleRounds"]');
                if (battleRounds) {
                    battleRounds.value = String(data.case.rounds || 12);
                    battleRounds.dispatchEvent(new Event('input', {bubbles: true}));
                    battleRounds.dispatchEvent(new Event('change', {bubbles: true}));
                }
                // Clean-room mode: no science, skills, stats or admiral
                // equipment may leak from the logged-in account or a prior run.
                clear('[id^="attackerScienceLevel-"], [id^="defenderScienceLevel-"], [id^="attackerAbilityLevel-"], [id^="defenderAbilityLevel-"], [id^="attackerAdmiralEquipmentValue-"], [id^="defenderAdmiralEquipmentValue-"]');
                if (typeof simulatorUpdatePopDisplays === 'function') simulatorUpdatePopDisplays();
                const read = id => {
                    const el = document.getElementById(id);
                    return el ? (el.type === 'checkbox' ? Number(el.checked) : Number(el.value || 0)) : 0;
                };
                const nonZero = [...form.querySelectorAll('[id^="attackerScienceLevel-"], [id^="defenderScienceLevel-"], [id^="attackerAbilityLevel-"], [id^="defenderAbilityLevel-"], [id^="attackerAdmiralEquipmentValue-"], [id^="defenderAdmiralEquipmentValue-"]')]
                    .filter(el => Number(String(el.value || 0).replace(',', '.')) !== 0)
                    .map(el => ({id: el.id, value: el.value}));
                return {
                    missing, attackerLeadSet, defenderLeadSet, nonZero,
                    races: {attacker: Number(document.getElementById('choose_race1')?.value || 0), defender: Number(document.getElementById('choose_race2')?.value || 0)},
                    rounds: Number(form.querySelector('select[name="battleRounds"]')?.value || 0),
                    population: {
                        attacker: typeof simulatorGetPop === 'function' ? simulatorGetPop('attacker', 'ships') : null,
                        defender: typeof simulatorGetPop === 'function' ? simulatorGetPop('defender', 'ships') : null,
                        defence: typeof simulatorGetPop === 'function' ? simulatorGetPop('defender', 'defence') : null,
                        maxShips: Number(window.battlesimulatorPopShips || 0),
                        maxDefence: Number(window.battlesimulatorPopDefence || 0),
                    },
                    commanderSlots: data.commanderSlots,
                };
            }""", payload)
            if applied.get("missing", {}).get("attackerShips") or applied.get("missing", {}).get("defenderShips"):
                raise BrowserAutomationError(f"Корабль отсутствует в форме: {applied.get('missing')}")
            if applied.get("missing", {}).get("defence") or applied.get("missing", {}).get("commanders"):
                raise BrowserAutomationError(f"Оборона или командир отсутствуют в форме: {applied.get('missing')}")
            if case.attacker_lead and not applied.get("attackerLeadSet"):
                raise BrowserAutomationError(f"Ведущий командир атакующего не выбран: {case.attacker_lead}")
            if case.defender_lead and not applied.get("defenderLeadSet"):
                raise BrowserAutomationError(f"Ведущий командир защитника не выбран: {case.defender_lead}")
            if applied.get("nonZero"):
                raise BrowserAutomationError(f"После обнуления остались технологии: {applied['nonZero']}")
            races = applied.get("races") or {}
            if int(races.get("attacker") or 0) != attacker_race_id or int(races.get("defender") or 0) != int(case.defender_race_id):
                raise BrowserAutomationError(f"Форма приняла другие расы: {races}")
            if int(applied.get("rounds") or 0) != int(case.rounds):
                raise BrowserAutomationError(f"Форма приняла {applied.get('rounds')} раундов вместо {case.rounds}")
            effective_form = await simulator.evaluate(_SIMULATOR_FORM_STATE_JS)
            population = applied.get("population") or {}
            if any(
                population.get(key) is not None and int(population.get(key) or 0) > int(population.get(limit) or 0)
                for key, limit in (("attacker", "maxShips"), ("defender", "maxShips"))
            ):
                raise BrowserAutomationError(f"Состав превышает лимит населения: {population}")
            if population.get("defence") is not None and int(population.get("defence") or 0) > int(population.get("maxDefence") or 0):
                raise BrowserAutomationError(f"Оборона превышает лимит населения: {population}")
            async with simulator.expect_popup(timeout=30_000) as popup_info:
                submitted = await simulator.evaluate("() => simulatorSimulate()")
                if not submitted:
                    raise BrowserAutomationError("Симулятор не принял проверочный состав")
            report = await popup_info.value
            report_url = _safe_page_url(report)
            await report.wait_for_load_state("domcontentloaded", timeout=30_000)
            await report.wait_for_url("**/battleReport.php*", timeout=30_000, wait_until="domcontentloaded")
            report_url = _safe_page_url(report)
            await report.locator("body").wait_for(state="attached", timeout=15_000)
            analysis = await _expand_report_analysis(report)
            artifact = await capture_page(
                report, report_root, keep=None, folder_name=f"{index:04d}_{case.case_id}",
                metadata_extra={
                    "run_id": run_id, "case_id": case.case_id, "case_title": case.title,
                    "planned_case": case.to_dict(), "effective_form": effective_form,
                    "analysis": analysis, "clean_technologies": True,
                },
            )
            for _ in range(60):
                body = await report.locator("body").inner_text(timeout=10_000)
                winner, attacker_population, defender_population, report_rounds = parse_report_summary(body)
                if winner != "Не определён" and report_rounds > 0:
                    break
                await report.wait_for_timeout(250)
            if winner == "Не определён" or report_rounds <= 0:
                error_text = "Отчёт сохранён, но итог или раунды не распознаны"
        except Exception as exc:
            error_text = str(exc)
            if report is not None and artifact is None and not report.is_closed():
                try:
                    effective_form = effective_form or await simulator.evaluate(_SIMULATOR_FORM_STATE_JS)
                    artifact = await capture_page(
                        report, report_root, keep=None, folder_name=f"{index:04d}_{case.case_id}_partial",
                        metadata_extra={
                            "run_id": run_id, "case_id": case.case_id, "case_title": case.title,
                            "planned_case": case.to_dict(), "effective_form": effective_form,
                            "analysis": analysis, "clean_technologies": True,
                            "capture_stage": "partial-after-error", "error": error_text,
                        },
                    )
                except Exception as capture_exc:
                    error_text = f"{error_text}; частичный архив не сохранён: {capture_exc}"
        finally:
            if report is not None:
                report_url = report_url or _safe_page_url(report)
            if report is not None and not report.is_closed():
                try:
                    await report.close()
                except Exception:
                    pass
            try:
                await simulator.bring_to_front()
            except Exception:
                pass

        row = {
            "run_id": run_id, "kind": "verification", "case_id": case.case_id,
            "case_title": case.title, "candidate_title": case.title,
            "own_ships": dict(case.attacker_ships),
            "enemy_scenario": f"{RACE_LABELS.get(case.defender_race_id, case.defender_race_id)} · {case.title}",
            "enemy_race": case.defender_race_id, "enemy_ships": dict(case.defender_ships),
            "enemy_levels": dict(case.defender_levels),
            "enemy_commanders": dict(case.defender_commanders),
            "enemy_defence": dict(case.defender_defence),
            "planned_case": case.to_dict(),
            "effective_form": effective_form, "applied": applied,
            "winner": winner, "attacker_population": attacker_population,
            "defender_population": defender_population, "rounds": report_rounds,
            "report_url": report_url,
            "report_artifact": artifact, "analysis": analysis, "analysis_text": body,
            "error": error_text,
        }
        append_trial(row)
        results.append(row)
        if error_text:
            failed += 1
            failures.append({"case_id": case.case_id, "error": error_text})
        else:
            completed += 1
        # Keep the manifest useful even if the desktop app or browser is
        # interrupted between two reports.  The already archived folders and
        # journal rows remain the source of truth for completed cases.
        progress_manifest = dict(manifest)
        progress_manifest.update({
            "status": "running", "completed": completed, "failed": failed,
            "last_case": case.case_id, "failures": failures,
        })
        write_campaign_manifest(manifest_path, progress_manifest)
        if progress:
            progress(index, total, f"{case.title}{' · ' + error_text if error_text else ''}")

    final_manifest = dict(manifest)
    final_manifest.update({
        "status": "completed" if not failures else "completed_with_errors",
        "completed": completed, "failed": failed,
        "failures": failures,
    })
    write_campaign_manifest(manifest_path, final_manifest)
    return {
        "run_id": run_id, "planned": total, "completed": completed, "failed": failed,
        "manifest": str(manifest_path), "report_root": str(report_root), "results": results,
    }


async def _run_simulator_candidates(
    worker: BrowserWorker, scan: EnemyScan | None, *, own_level: int = 10, candidate_limit: int = 20,
    candidates_override: list[CounterPlan] | None = None, scenarios: list[SimulatorScenario] | None = None,
    rank_results: bool = True, run_kind: str = "counter",
    progress: Callable[[int, int, str], None] | None = None,
    enemy_race_id: int | None = None,
    leave_report_open: bool = False,
    clean_technologies: bool = True,
) -> list[SimulatorResult]:
    """Run the real in-game simulator and return only its own report facts.

    The source tab is captured once from the active-tab resolver.  Pop-up
    reports are explicitly created, parsed and closed by this routine; no other
    Nemexia page is selected or closed.
    """
    page = await worker._ensure_fleets_page()
    await worker._assert_no_captcha(page, "captcha_simulator")
    if scenarios is None:
        if scan is None:
            raise ValueError("Для контр-флота отсутствует разведка")
        scenarios = [SimulatorScenario(
            "Разведка", enemy_race_id or _scan_race_id(scan), scan.ships, scan.levels, scan.commanders, scan.defence,
        )]
    selected_attacker_race = int(await page.evaluate(
        "() => Number(document.querySelector('#choose_race1')?.value || 1)"
    ))
    if selected_attacker_race not in (1, 2, 3):
        selected_attacker_race = 1
    candidates = (candidates_override or (
        build_simulator_candidates(scan, own_level=own_level, race_id=selected_attacker_race) if scan else []
    ))[:candidate_limit]
    if not candidates:
        raise ValueError("Не удалось собрать варианты для проверки в симуляторе")
    run_id = uuid4().hex[:12]
    total_trials = len(candidates) * len(scenarios)
    completed_trials = 0
    if not await page.locator("#simulatorForm").count():
        raise BrowserAutomationError("На странице «Полёты» не найдена форма симулятора")
    results: list[SimulatorResult] = []
    simulator = None
    try:
        # The editable simulator is already embedded in the player's Fleets
        # tab.  Calling simulatorSimulate here submitted its empty form once,
        # creating a spurious report window before the actual trial below.
        # Reuse this page and open exactly one report popup per candidate.
        simulator = page
        # Loading game data is asynchronous.  Wait for its AJAX request before
        # starting the trials, otherwise its delayed callback can overwrite a
        # composition while the report is being submitted.
        async with simulator.expect_response(
            lambda response: "ajax_fleets.php" in response.url and response.request.method == "POST",
            timeout=30_000,
        ):
            await simulator.evaluate("""() => {
                if (typeof simulatorLoadData === 'function') simulatorLoadData();
                if (typeof showTab === 'function') showTab('TabSimulator');
            }""")
        await simulator.locator("#simulatorForm").wait_for(state="attached", timeout=15_000)
        # Load current own values once, then apply the exact same commanders,
        # priorities, sciences, abilities and equipment to the defender.
        mirror = await simulator.evaluate("""() => [...document.querySelectorAll(
            '#simulatorForm [id^="attackerCommanderShip"], #simulatorForm #attackerLeadCommander, '
            + '#simulatorForm [id^="attackerScienceLevel"], #simulatorForm [id^="attackerAbilityLevel"], '
            + '#simulatorForm [id^="attackerAdmiralEquipmentValue"], #simulatorForm #battleRounds'
        )].map(el => ({id: el.id, value: el.value, checked: el.checked}))""")
        commander_population = await simulator.evaluate("""() => [...document.querySelectorAll(
            '#simulatorForm [id^="attackerCommanderShipCount-"]'
        )].reduce((total, count) => {
            const id = count.id.replace('Count', 'Pop');
            return total + Number(count.value || 0) * Number(document.getElementById(id)?.value || 0);
        }, 0)""")
        # Counter mode previously filled all 25k with regular ships and then
        # added mirrored commanders on top, so the game refused to submit.
        # Preserve the composition but reserve their actual population first.
        candidates = [fit_candidate_population(
            candidate, 25_000 - int(commander_population or 0), catalog_for_race(selected_attacker_race)
        ) for candidate in candidates]
        for candidate in candidates:
            for raw_scenario in scenarios:
                scenario = _normalise_scenario_commanders(raw_scenario)
                await worker._assert_no_captcha(page, "captcha_simulator_batch")
                payload = {
                "candidate": candidate.ships,
                "ownLevel": max(0, int(own_level)),
                "enemy": scenario.ships,
                "levels": scenario.levels,
                "commanders": scenario.commanders,
                "commanderSlots": COMMANDER_SLOTS,
                "defence": scenario.defence,
                "defenderEquipmentMargin": DEFENDER_EQUIPMENT_MARGIN_PP,
                "enemyRace": scenario.race_id,
                "attackerRace": selected_attacker_race,
                "mirror": mirror,
                "cleanTechnologies": clean_technologies,
                }
                applied_enemy = await simulator.evaluate("""data => {
                const form = document.querySelector('#simulatorForm');
                if (!form) throw new Error('Форма симулятора не найдена');
                const normal = value => String(value || '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ');
                const set = (id, value) => {
                    const el = document.getElementById(id);
                    if (!el) return false;
                    if (el.type === 'checkbox') {
                        el.checked = Number(value) > 0;
                        if (el.checked) el.setAttribute('checked', 'checked');
                        else el.removeAttribute('checked');
                    }
                    else el.value = String(value);
                    el.dispatchEvent(new Event('input', {bubbles:true}));
                    el.dispatchEvent(new Event('change', {bubbles:true}));
                    return true;
                };
                set('choose_race1', data.attackerRace); set('choose_race2', data.enemyRace);
                if (typeof simulatorChangeNames === 'function') simulatorChangeNames();
                const read = id => {
                    const el = document.getElementById(id);
                    return el ? (el.type === 'checkbox' ? Number(el.checked) : Number(el.value || 0)) : 0;
                };
                [...form.querySelectorAll('[id^="attackerShipCount-"], [id^="defenderShipCount-"], [id^="defenderDefenceCount-"], [id^="defenderCommanderShipCount-"]')]
                    .forEach(el => {
                        if (el.type === 'checkbox') { el.checked = false; el.removeAttribute('checked'); }
                        else el.value = '0';
                    });
                [...form.querySelectorAll('[id^="attackerShipLevel-"], [id^="defenderShipLevel-"], [id^="defenderCommanderShipLevel-"]')]
                    .forEach(el => { el.value = '0'; });
                const slotsFromGame = (source, prefix) => Object.fromEntries(
                    Object.entries(source || {}).map(([slot, item]) => [normal(item?.name), Number(slot)])
                );
                const raceShips = window.raceShips?.[data.enemyRace] || {};
                const attackerSlots = slotsFromGame(window.raceShips?.[data.attackerRace], 'attackerShip');
                const slots = slotsFromGame(raceShips, 'defenderShip');
                const defenceSlots = slotsFromGame(window.raceDefence?.[data.enemyRace], 'defenderDefence');
                Object.entries(data.candidate).forEach(([name, count]) => { const slot = attackerSlots[normal(name)]; if (slot) { set(`attackerShipCount-${slot}`, count); set(`attackerShipLevel-${slot}`, data.ownLevel); } });
                Object.entries(data.enemy).forEach(([name, count]) => { const slot = slots[normal(name)]; if (slot) { set(`defenderShipCount-${slot}`, count); set(`defenderShipLevel-${slot}`, data.levels[name] ?? 10); } });
                Object.entries(data.defence).forEach(([name, count]) => { const slot = defenceSlots[normal(name)]; if (slot) set(`defenderDefenceCount-${slot}`, count); });
                data.mirror.forEach(item => {
                    const target = item.id
                        .replace(/^attackerCommanderShip/, 'defenderCommanderShip')
                        .replace(/^attackerLeadCommander$/, 'defenderLeadCommander')
                        .replace(/^attackerScienceLevel/, 'defenderScienceLevel')
                        .replace(/^attackerAbilityLevel/, 'defenderAbilityLevel')
                        .replace(/^attackerAdmiralEquipmentValue/, 'defenderAdmiralEquipmentValue');
                    if (target !== item.id) {
                        const equipment = target === 'defenderAdmiralEquipmentValue-attack' || target === 'defenderAdmiralEquipmentValue-life';
                        const raw = Number(String(item.value).replace(',', '.'));
                        const value = equipment && Number.isFinite(raw) ? Math.round((raw + data.defenderEquipmentMargin) * 100) / 100 : item.value;
                        set(target, value);
                    }
                });
                if (data.cleanTechnologies) {
                    [...form.querySelectorAll('[id^="attackerScienceLevel-"], [id^="defenderScienceLevel-"], [id^="attackerAbilityLevel-"], [id^="defenderAbilityLevel-"], [id^="attackerAdmiralEquipmentValue-"], [id^="defenderAdmiralEquipmentValue-"]')]
                        .forEach(el => set(el.id, 0));
                }
                const rounds = form.querySelector('select[name="battleRounds"]');
                if (rounds) {
                    rounds.value = '12';
                    rounds.dispatchEvent(new Event('change', {bubbles: true}));
                }
                // Commander controls have their own IDs.  Read the names from
                // the live simulator form after the defender race was set;
                // this avoids relying on a stale/static slot table.
                const commanderSlots = Object.fromEntries(
                    [...form.querySelectorAll('[id^="defenderCommanderShipName-"]')].map(el => {
                        const slot = el.id.match(/-(\d+)$/)?.[1];
                        return [normal(el.textContent), Number(slot)];
                    }).filter(([name, slot]) => name && slot)
                );
                Object.entries(data.commanders).forEach(([name, values]) => {
                    const slot = commanderSlots[normal(name)] || data.commanderSlots[name];
                    if (slot) {
                        set(`defenderCommanderShipCount-${slot}`, values[0]);
                        set(`defenderCommanderShipLevel-${slot}`, values[1]);
                    }
                });
                return { ships: Object.fromEntries(Object.keys(data.enemy).map(name => {
                    const slot = slots[normal(name)];
                    return [name, slot ? read(`defenderShipCount-${slot}`) : 0];
                })), commanders: Object.fromEntries(Object.keys(data.commanders).map(name => {
                    const slot = commanderSlots[normal(name)] || data.commanderSlots[name];
                    return [name, slot ? [
                        read(`defenderCommanderShipCount-${slot}`),
                        read(`defenderCommanderShipLevel-${slot}`)
                    ] : [0, 0]];
                })), defence: Object.fromEntries(Object.keys(data.defence).map(name => {
                    const slot = defenceSlots[normal(name)];
                    return [name, slot ? read(`defenderDefenceCount-${slot}`) : 0];
                })) };
                }""", payload)
                missing_enemy = {
                    name: int(count) for name, count in scenario.ships.items()
                    if int(applied_enemy.get("ships", {}).get(name, 0)) != int(count)
                }
                if missing_enemy:
                    details = ", ".join(f"{name}: нужно {count}, в форме {applied_enemy.get('ships', {}).get(name, 0)}" for name, count in missing_enemy.items())
                    raise BrowserAutomationError(f"Корабли противника не подставились в симулятор: {details}")
                missing_commanders = {
                    name: values for name, values in scenario.commanders.items()
                    if tuple(applied_enemy.get("commanders", {}).get(name, (0, 0))) != tuple(values)
                }
                if missing_commanders:
                    details = ", ".join(
                        f"{name}: нужно {values[0]} ур. {values[1]}, в форме {applied_enemy.get('commanders', {}).get(name)}"
                        for name, values in missing_commanders.items()
                    )
                    raise BrowserAutomationError(f"Командные корабли противника не подставились в симулятор: {details}")
                missing_defence = {
                    name: int(count) for name, count in scenario.defence.items()
                    if int(applied_enemy.get("defence", {}).get(name, 0)) != int(count)
                }
                if missing_defence:
                    details = ", ".join(f"{name}: нужно {count}" for name, count in missing_defence.items())
                    raise BrowserAutomationError(f"Оборона противника не подставилась в симулятор: {details}")
                population = await simulator.evaluate("""() => {
                    simulatorUpdatePopDisplays();
                    return {
                        attacker: simulatorGetPop('attacker', 'ships'),
                        defender: simulatorGetPop('defender', 'ships'),
                        max: battlesimulatorPopShips,
                    };
                }""")
                if int(population["attacker"]) > int(population["max"]) or int(population["defender"]) > int(population["max"]):
                    raise BrowserAutomationError(
                        f"Симулятор отклонил состав по населению: мы {population['attacker']}/{population['max']}, "
                        f"враг {population['defender']}/{population['max']}"
                    )
                async with simulator.expect_popup(timeout=30_000) as popup_info:
                    submitted = await simulator.evaluate("() => simulatorSimulate()")
                    if not submitted:
                        raise BrowserAutomationError("Симулятор не принял состав для запуска")
                report = await popup_info.value
                try:
                    # The simulator opens an intermediate ``fleets.php`` page
                    # first, then submits it to battleReport.php.  Reading the
                    # first page produced the former “Не определён” entries.
                    await report.wait_for_load_state("domcontentloaded", timeout=30_000)
                    try:
                        await report.wait_for_url("**/battleReport.php*", timeout=30_000, wait_until="domcontentloaded")
                    except Exception as exc:
                        raise BrowserAutomationError(
                            f"Симулятор не перешёл на финальный отчёт за 30 секунд: {report.url}"
                        ) from exc
                    analysis = await _expand_report_analysis(report)
                    effective_form = await simulator.evaluate(_SIMULATOR_FORM_STATE_JS)
                    report_artifact = None
                    capture_warning = ""
                    try:
                        report_artifact = await capture_page(
                            report, BATTLE_ARCHIVE_DIR / run_id, keep=None,
                            folder_name=f"{completed_trials + 1:04d}",
                            metadata_extra={
                                "run_id": run_id, "kind": run_kind,
                                "candidate_title": candidate.title, "scenario": scenario.title,
                                "planned_candidate": dict(candidate.ships),
                                "planned_scenario": {
                                    "ships": scenario.ships, "levels": scenario.levels,
                                    "commanders": scenario.commanders, "defence": scenario.defence,
                                },
                                "effective_form": effective_form, "analysis": analysis,
                                "clean_technologies": clean_technologies,
                            },
                        )
                    except Exception as exc:
                        capture_warning = f"Полный архив не сохранён: {exc}"
                    body = ""
                    winner, attacker_population, defender_population, rounds = "Не определён", None, None, 0
                    for _ in range(60):
                        body = await report.locator("body").inner_text(timeout=10_000)
                        winner, attacker_population, defender_population, rounds = parse_report_summary(body)
                        if winner != "Не определён" and rounds > 0:
                            break
                        await report.wait_for_timeout(250)
                    if winner == "Не определён" or rounds <= 0:
                        raise BrowserAutomationError("Симулятор открыл отчёт без финального итога; бой не сохранён")
                    residuals = await report.evaluate("""commanderNames => {
                        const final = document.querySelector('#BattleEnd .defender');
                        if (!final) return {ships: {}, commanders: {}, defence: {}, defencePopulation: null};
                        const titleName = el => {
                            const title = el.getAttribute('title') || '';
                            const match = title.match(/header=\\[([^\\]]+)\\]/i);
                            return match ? match[1].trim() : '';
                        };
                        // Some final-result tiles deliberately omit their title.
                        // Learn image -> unit name from the preceding rounds,
                        // where the same icon still carries the tooltip, then
                        // use it for the otherwise nameless BattleEnd tile.
                        const imageKey = el => {
                            const src = el.querySelector('img')?.getAttribute('src') || '';
                            return src.split(/[?#]/, 1)[0].split('/').pop().toLowerCase();
                        };
                        const namesByImage = new Map();
                        document.querySelectorAll('.ship, .def').forEach(el => {
                            const name = titleName(el);
                            const key = imageKey(el);
                            if (name && key) namesByImage.set(key, name);
                        });
                        const unitName = el => titleName(el) || namesByImage.get(imageKey(el)) || '';
                        const unreadable = [...final.querySelectorAll('.ships .ship, .defence .def')]
                            .filter(el => !unitName(el))
                            .map(el => ({className: el.className, image: imageKey(el), text: el.textContent?.trim() || ''}));
                        const read = selector => Object.fromEntries([...final.querySelectorAll(selector)].map(el => {
                            const name = unitName(el);
                            const raw = el.querySelector('span')?.textContent || '0';
                            return [name, Number(raw.replace(/[^0-9]/g, '')) || 0];
                        }).filter(([name, count]) => name && count));
                        const ships = read('.ships .ship');
                        const defence = read('.defence .def');
                        const commanders = {};
                        const commanderSet = new Set(commanderNames);
                        Object.keys(ships).forEach(name => {
                            if (commanderSet.has(name)) { commanders[name] = ships[name]; delete ships[name]; }
                        });
                        const info = [...final.querySelectorAll('.message.information, .information')]
                            .map(el => el.textContent || '').join(' ');
                        const match = info.match(/Оборона[^0-9]{0,50}([0-9 ][0-9 ]*)/i);
                        return {ships, commanders, defence, defencePopulation: match ? Number(match[1].replace(/\\D/g, '')) : null, unreadable};
                    }""", list(COMMANDER_SLOTS))
                    results.append(SimulatorResult(
                        candidate.title, dict(candidate.ships), candidate.population, winner,
                        attacker_population, defender_population, rounds, report.url, scenario.title,
                        dict(residuals.get("ships", {})), dict(residuals.get("commanders", {})),
                        dict(residuals.get("defence", {})), residuals.get("defencePopulation"),
                        scenario.race_id, dict(scenario.ships), dict(scenario.levels),
                        dict(scenario.commanders), dict(scenario.defence),
                    ))
                    append_trial({
                        "run_id": run_id, "kind": run_kind, "candidate_title": candidate.title,
                        "candidate_population": candidate.population, "own_ships": candidate.ships,
                        "enemy_scenario": scenario.title, "enemy_race": scenario.race_id,
                        "enemy_ships": scenario.ships, "enemy_levels": scenario.levels,
                        "enemy_commanders": scenario.commanders,
                        "enemy_defence": scenario.defence, "residuals": residuals,
                        "winner": winner, "attacker_population": attacker_population,
                        "defender_population": defender_population, "rounds": rounds,
                        "report_url": report.url, "mirror_settings": mirror,
                        "report_artifact": report_artifact, "effective_form": effective_form,
                        "analysis": analysis, "capture_warning": capture_warning,
                        "analysis_text": body,
                    })
                    completed_trials += 1
                    if progress:
                        progress(completed_trials, total_trials, f"{candidate.title} · {scenario.title}")
                finally:
                    if leave_report_open:
                        await report.bring_to_front()
                    else:
                        if not report.is_closed():
                            await report.close()
                        await simulator.bring_to_front()
    finally:
        if not leave_report_open:
            await page.bring_to_front()
    if not results:
        raise BrowserAutomationError("Симулятор не вернул ни одного проверяемого отчёта")
    return rank_simulator_results(results, top_n=5) if rank_results else results


def install_battle_feature(app_module: Any, app_class: type[Any]) -> None:
    if getattr(app_class, "_battle_feature_installed", False):
        return
    original_build_shell = app_class._build_shell
    original_show_page = app_class.show_page
    original_render_all = app_class.render_all

    def render_planet_cards(self: Any) -> None:
        for child in self.battle_planet_cards.winfo_children():
            child.destroy()
        for index, plan in enumerate(self.battle_plans):
            reserve = int(self.battle_planet_reserve_var.get())
            combat_limit = 25_000 - reserve
            card = app_module.tk.Frame(self.battle_planet_cards, bg=app_module.PANEL, highlightthickness=1,
                                       highlightbackground=app_module.PANEL_ALT, padx=14, pady=12)
            card.grid(row=index, column=0, sticky="ew", pady=4)
            profile = plan.title.removeprefix("Постоянный флот · ")
            expanded = index in self.battle_planet_expanded
            app_module.tk.Button(
                card, text=f"{'▾' if expanded else '▸'}  Планета {index + 1} · Топ-{plan.rank} · {profile}",
                command=lambda i=index: self.battle_toggle_planet_card(i), anchor="w", cursor="hand2",
                bg=app_module.PANEL, fg=app_module.ACCENT, activebackground=app_module.PANEL_ALT,
                activeforeground=app_module.TEXT, relief="flat", bd=0, padx=0, pady=0,
                font=("Segoe UI Semibold", 11), highlightthickness=0,
            ).pack(fill="x")
            reason = plan.counters[0] if plan.counters else "сбалансированное покрытие регулярных красных и зелёных кораблей"
            app_module.tk.Label(
                card,
                text=(f"Гражданское: {reserve:,}  ·  Боевой лимит: {combat_limit:,}  ·  "
                      f"Почему в топе: акцент «{profile}», {reason}. ").replace(",", " "),
                bg=app_module.PANEL, fg=app_module.MUTED, anchor="w", justify="left",
                font=("Segoe UI", 9), wraplength=1080,
            ).pack(fill="x", pady=(5, 0))
            if expanded:
                app_module.tk.Frame(card, bg=app_module.PANEL_ALT, height=1).pack(fill="x", pady=(9, 8))
                app_module.tk.Label(card, text="Состав атакующей расы", bg=app_module.PANEL, fg=app_module.MUTED,
                                    anchor="w", font=("Segoe UI", 9)).pack(fill="x")
                fleet = "\n".join(f"{name:<18} × {count:,}".replace(",", " ") for name, count in plan.ships.items())
                app_module.tk.Label(card, text=fleet, bg=app_module.PANEL, fg=app_module.TEXT, justify="left", anchor="w",
                                    font=("Consolas", 10)).pack(fill="x", pady=(3, 4))
                if plan.ability_notes:
                    app_module.tk.Label(card, text="Спецумения: " + " · ".join(plan.ability_notes[:2]),
                                        bg=app_module.PANEL, fg=app_module.MUTED, justify="left", anchor="w",
                                        wraplength=1080, font=("Segoe UI", 8)).pack(fill="x")
        self.battle_planet_cards.columnconfigure(0, weight=1)

    def battle_toggle_planet_card(self: Any, index: int) -> None:
        if index in self.battle_planet_expanded:
            self.battle_planet_expanded.remove(index)
        else:
            self.battle_planet_expanded.add(index)
        render_planet_cards(self)

    def render_counter_cards(self: Any) -> None:
        for child in self.battle_counter_cards.winfo_children():
            child.destroy()
        for index, plan in enumerate(self.battle_plans):
            expanded = index in self.battle_counter_expanded
            simulated = isinstance(plan, SimulatorResult)
            card_label = plan.title if self.battle_result_kind == "waves" else f"Топ-{index + 1} · {plan.title}"
            card = app_module.tk.Frame(self.battle_counter_cards, bg=app_module.PANEL, highlightthickness=1,
                                       highlightbackground=app_module.PANEL_ALT, padx=14, pady=12)
            card.grid(row=index, column=0, sticky="ew", pady=4)
            header = app_module.tk.Frame(card, bg=app_module.PANEL)
            header.pack(fill="x")
            if simulated and self.battle_result_kind == "waves":
                app_module.tk.Button(
                    header, text="Открыть отчёт", command=lambda i=index: self.battle_open_wave_report(i),
                    bg=app_module.PANEL_ALT, fg=app_module.TEXT, activebackground=app_module.ACCENT,
                    activeforeground=app_module.TEXT, relief="flat", bd=0, padx=10, pady=5,
                    cursor="hand2", font=("Segoe UI Semibold", 9),
                ).pack(side="right")
            app_module.tk.Button(
                header, text=(f"{'▾' if expanded else '▸'}  {card_label}"
                            + (f" · {plan.winner}" if simulated else "")),
                command=lambda i=index: self.battle_toggle_counter_card(i), anchor="w", cursor="hand2",
                bg=app_module.PANEL, fg=app_module.ACCENT, activebackground=app_module.PANEL_ALT,
                activeforeground=app_module.TEXT, relief="flat", bd=0, padx=0, pady=0,
                font=("Segoe UI Semibold", 11), highlightthickness=0,
            ).pack(side="left", fill="x", expand=True)
            reason = (
                f"проверено игрой: {plan.winner}; раундов: {plan.rounds or 'не указано'}"
                if simulated else (plan.counters[0] if plan.counters else "сбалансированный расчёт по базовым статам")
            )
            app_module.tk.Label(
                card, text=f"Боевой лимит: {plan.population:,} / 25 000  ·  Почему: {reason}".replace(",", " "),
                bg=app_module.PANEL, fg=app_module.MUTED, anchor="w", justify="left",
                font=("Segoe UI", 9), wraplength=1080,
            ).pack(fill="x", pady=(5, 0))
            if expanded:
                app_module.tk.Frame(card, bg=app_module.PANEL_ALT, height=1).pack(fill="x", pady=(9, 8))
                fleet = "\n".join(f"{name:<18} × {count:,}".replace(",", " ") for name, count in plan.ships.items())
                app_module.tk.Label(card, text="Состав атакующей расы", bg=app_module.PANEL, fg=app_module.MUTED,
                                    anchor="w", font=("Segoe UI", 9)).pack(fill="x")
                app_module.tk.Label(card, text=fleet, bg=app_module.PANEL, fg=app_module.TEXT, justify="left", anchor="w",
                                    font=("Consolas", 10)).pack(fill="x", pady=(3, 8))
                if simulated:
                    survivor = ""
                    if plan.attacker_population is not None or plan.defender_population is not None:
                        survivor = (f"После боя: атакующий {plan.attacker_population if plan.attacker_population is not None else '—'}"
                                    f" · защитник {plan.defender_population if plan.defender_population is not None else '—'}")
                    if self.battle_result_kind == "waves":
                        defence_left = plan.defender_defence_population if plan.defender_defence_population is not None else "—"
                        survivor += f" · оборона {defence_left}"
                    links = survivor or "Итог считан из созданного симулятором отчёта"
                else:
                    links = " · ".join(plan.counters + plan.warnings) or "нет дополнительных связок"
                app_module.tk.Label(card, text=("Результат симулятора: " if simulated else "Контр‑связки: ") + links,
                                    bg=app_module.PANEL, fg=app_module.TEXT,
                                    justify="left", anchor="w", wraplength=1080, font=("Segoe UI", 9)).pack(fill="x")
                if simulated and self.battle_result_kind == "waves":
                    remaining = []
                    if plan.remaining_ships:
                        remaining.append("Корабли: " + ", ".join(f"{name} × {count}" for name, count in plan.remaining_ships.items()))
                    if plan.remaining_commanders:
                        remaining.append("Командные: " + ", ".join(f"{name} × {count}" for name, count in plan.remaining_commanders.items()))
                    if plan.remaining_defence:
                        remaining.append("Оборона: " + ", ".join(f"{name} × {count}" for name, count in plan.remaining_defence.items()))
                    app_module.tk.Label(
                        card, text="Остатки врага для следующей волны: " + (" · ".join(remaining) if remaining else "цель зачищена"),
                        bg=app_module.PANEL, fg=app_module.ACCENT if not remaining else app_module.TEXT,
                        justify="left", anchor="w", wraplength=1080, font=("Segoe UI", 9),
                    ).pack(fill="x", pady=(7, 0))
                if not simulated and plan.ability_notes:
                    app_module.tk.Label(card, text="Спецумения: " + " · ".join(plan.ability_notes),
                                        bg=app_module.PANEL, fg=app_module.MUTED, justify="left", anchor="w",
                                        wraplength=1080, font=("Segoe UI", 8)).pack(fill="x", pady=(5, 0))
        self.battle_counter_cards.columnconfigure(0, weight=1)

    def battle_toggle_counter_card(self: Any, index: int) -> None:
        if index in self.battle_counter_expanded:
            self.battle_counter_expanded.remove(index)
        else:
            self.battle_counter_expanded.add(index)
        render_counter_cards(self)

    def battle_open_wave_report(self: Any, index: int) -> None:
        """Recreate one selected wave and keep its real game report open."""
        if self.battle_result_kind != "waves" or not (0 <= index < len(self.battle_plans)):
            return
        plan = self.battle_plans[index]
        if not isinstance(plan, SimulatorResult) or not plan.enemy_race_id:
            app_module.messagebox.showerror(app_module.APP_NAME, "Для этой волны не сохранён исходный состав врага. Пересчитай волны.")
            return
        scenario = SimulatorScenario(
            plan.scenario, plan.enemy_race_id, dict(plan.enemy_ships), dict(plan.enemy_levels),
            dict(plan.enemy_commanders), dict(plan.enemy_defence),
        )

        async def operation() -> list[SimulatorResult]:
            await self.worker.connect(self.endpoint())
            return await _run_simulator_candidates(
                self.worker, None, own_level=int(self.battle_own_level_var.get()),
                candidates_override=[plan], scenarios=[scenario], candidate_limit=1,
                rank_results=False, run_kind="wave-preview", enemy_race_id=plan.enemy_race_id,
                leave_report_open=True,
            )

        def success(_: list[SimulatorResult]) -> None:
            self.battle_progress_var.set(f"Открыт игровой отчёт: {plan.title}. Атака не отправлялась.")

        self.battle_progress_var.set(f"Открываю игровой отчёт для {plan.title}…")
        self.run_task(operation(), "Симулятор: открываю отчёт выбранной волны…", success)

    def _battle_plan_to_cache(plan: CounterPlan) -> dict[str, Any]:
        return {
            "rank": plan.rank, "title": plan.title, "ships": plan.ships, "population": plan.population,
            "score": plan.score, "counters": list(plan.counters), "warnings": list(plan.warnings),
        }

    def _battle_plan_from_cache(row: dict[str, Any]) -> CounterPlan:
        return CounterPlan(
            int(row.get("rank") or 0), str(row.get("title") or "Сохранённая сборка"),
            {str(name): int(count) for name, count in dict(row.get("ships") or {}).items()},
            int(row.get("population") or 0), float(row.get("score") or 0),
            tuple(str(item) for item in row.get("counters") or ()),
            tuple(str(item) for item in row.get("warnings") or ()), (), (),
        )

    def battle_open_simulation_log(self: Any) -> None:
        """Show persisted reports with both fleets, not merely a final rank."""
        tk, ttk = app_module.tk, app_module.ttk
        rows = load_recent_trials()
        window = tk.Toplevel(self)
        window.title("Журнал боёв симулятора")
        window.geometry("1160x680")
        window.configure(bg=app_module.BG)
        tk.Label(window, text="Журнал симулятора · каждый отчёт сохранён сразу после боя", bg=app_module.BG,
                 fg=app_module.TEXT, anchor="w", font=("Segoe UI Semibold", 11)).pack(fill="x", padx=14, pady=(14, 7))
        content = tk.Frame(window, bg=app_module.BG)
        content.pack(fill="both", expand=True, padx=14, pady=(0, 14))
        tree = ttk.Treeview(content, columns=("time", "kind", "own", "enemy", "result", "left", "rounds"), show="headings")
        headings = (("time", "Время"), ("kind", "Режим"), ("own", "Наш флот"), ("enemy", "Противник"),
                    ("result", "Итог"), ("left", "Остаток (мы / враг)"), ("rounds", "Раунды"))
        widths = {"time": 145, "kind": 90, "own": 210, "enemy": 240, "result": 155, "left": 165, "rounds": 75}
        for key, label in headings:
            tree.heading(key, text=label)
            tree.column(key, width=widths[key], anchor="w")
        scrollbar = ttk.Scrollbar(content, orient="vertical", command=tree.yview)
        tree.configure(yscrollcommand=scrollbar.set)
        tree.grid(row=0, column=0, sticky="nsew")
        scrollbar.grid(row=0, column=1, sticky="ns")
        detail = tk.Text(content, height=12, bg=app_module.INPUT, fg=app_module.TEXT, insertbackground=app_module.TEXT,
                         relief="flat", padx=12, pady=10, font=("Consolas", 9), state="disabled")
        detail.grid(row=1, column=0, columnspan=2, sticky="ew", pady=(10, 0))
        content.rowconfigure(0, weight=1)
        content.columnconfigure(0, weight=1)
        item_rows: dict[str, dict[str, Any]] = {}
        for row in rows:
            incomplete = row.get("winner") == "Не определён" or not row.get("rounds")
            kind_label = {
                "planet": "Топ‑7", "verification": "Проверки", "wave": "Волны",
                "wave-preview": "Волна",
            }.get(row.get("kind"), "Контр‑флот")
            item = tree.insert("", "end", values=(
                row.get("saved_at", ""), kind_label,
                row.get("candidate_title", ""), row.get("enemy_scenario", ""),
                ("Ошибка: " + str(row.get("error"))[:110] if row.get("error") else
                 ("Неполный старый отчёт" if incomplete else row.get("winner", ""))),
                ("— / —" if incomplete else f"{row.get('attacker_population', '—')} / {row.get('defender_population', '—')}"),
                ("—" if incomplete else row.get("rounds", "—")),
            ))
            item_rows[item] = row

        def show_detail(_: Any = None) -> None:
            selection = tree.selection()
            if not selection:
                return
            row = item_rows[selection[0]]
            own = "\n".join(f"  {name} × {count:,}".replace(",", " ") for name, count in dict(row.get("own_ships") or {}).items())
            enemy = "\n".join(f"  {name} × {count:,}".replace(",", " ") for name, count in dict(row.get("enemy_ships") or {}).items())
            text = (
                f"Серия: {row.get('run_id', '—')} · {row.get('saved_at', '—')}\n"
                f"Проверка: {row.get('case_title') or row.get('candidate_title', '—')}\n"
                f"Итог: {row.get('winner', '—')} · раундов: {row.get('rounds', '—')}\n"
                f"Остаток населения: мы {row.get('attacker_population', '—')} · враг {row.get('defender_population', '—')}\n\n"
                f"НАШ ФЛОТ · {row.get('candidate_title', '')}\n{own or '  —'}\n\n"
                f"ФЛОТ ПРОТИВНИКА · {row.get('enemy_scenario', '')}\n{enemy or '  —'}\n\n"
                f"Отчёт игры: {row.get('report_url', '—')}\n"
                f"Полный архив: {(row.get('report_artifact') or {}).get('folder', '—')}\n"
                f"Ошибка: {row.get('error') or '—'}\n\n"
                f"АНАЛИЗ ИГРЫ\n{row.get('analysis_text', 'Старый журнал: подробный текст отчёта ещё не сохранялся.')}"
            )
            detail.configure(state="normal")
            detail.delete("1.0", "end")
            detail.insert("1.0", text)
            detail.configure(state="disabled")

        tree.bind("<<TreeviewSelect>>", show_detail)
        if rows:
            tree.selection_set(tree.get_children()[0])
            show_detail()

    def battle_run_verification_campaign(self: Any) -> None:
        """Run the assistant-controlled, append-only evidence-gathering pack."""
        def progress(done: int, total: int, current: str) -> None:
            self.after(0, lambda: self.battle_progress_var.set(
                f"Проверочный пакет: {done} из {total} · осталось {total - done} · {current}"
            ))

        async def operation() -> dict[str, Any]:
            await self.worker.connect(self.endpoint())
            return await _run_verification_campaign(self.worker, progress=progress, rounds=12)

        def success(result: dict[str, Any]) -> None:
            self.connected = True
            self.battle_progress_var.set(
                f"Проверочный пакет завершён: {result['completed']} из {result['planned']} отчётов. "
                f"Ошибок: {result['failed']}. Архив без лимита: {result['report_root']}"
            )
            app_module.messagebox.showinfo(
                app_module.APP_NAME,
                f"Проверочные симуляции завершены.\n\n"
                f"Успешно: {result['completed']} из {result['planned']}\n"
                f"Ошибок: {result['failed']}\n\n"
                f"Манифест: {result['manifest']}\n"
                f"Полные отчёты: {result['report_root']}\n\n"
                "Каждый отчёт сохранён с раскрытым анализом всех раундов; старые отчёты не удаляются.",
            )

        self.battle_progress_var.set("Проверочный пакет: читаю текущую расу и форму…")
        self.run_task(operation(), "Симулятор: запуск проверочного пакета…", success)

    def render_battle(self: Any) -> None:
        if not hasattr(self, "battle_tree"):
            return
        for item in self.battle_tree.get_children():
            self.battle_tree.delete(item)
        plans: list[CounterPlan] = self.battle_plans
        if not plans:
            return
        scan: EnemyScan | None = self.battle_scan
        if self.battle_result_kind in {"counter", "waves"} and scan is not None:
            self.battle_planet_cards.pack_forget()
            self.battle_tree.pack_forget()
            if not self.battle_scan_area.winfo_manager():
                self.battle_scan_area.pack(fill="x", pady=(0, 8), before=self.battle_result_title_label)
            if not self.battle_counter_cards.winfo_manager():
                self.battle_counter_cards.pack(fill="x", expand=True)
            if not self.battle_results_shell.winfo_manager():
                self.battle_results_shell.pack(fill="both", expand=True)
            recognized = ", ".join(
                f"{name}: {count:,} (ур. {scan.levels.get(name, 10)})".replace(",", " ")
                for name, count in scan.ships.items()
            ) or "ничего"
            commanders = ", ".join(
                f"{name}: {count:,} (ур. {level})".replace(",", " ")
                for name, (count, level) in scan.commanders.items()
            )
            unknown = f" Не распознано: {' · '.join(scan.unknown_lines[:2])}." if scan.unknown_lines else ""
            commander_text = f" Командные: {commanders}." if commanders else ""
            self.battle_parsed_var.set(f"Распознано: {recognized}.{commander_text}{unknown}")
            if self.battle_result_kind == "waves":
                self.battle_result_title_var.set("ВОЛНЫ ВСКРЫТИЯ · КАЖДАЯ ДО 25 000 НАСЕЛЕНИЯ")
            else:
                self.battle_result_title_var.set("ТОП‑5 КОНТР‑ФЛОТОВ · ПРОВЕРЕНО ИГРОВЫМ СИМУЛЯТОРОМ · ЧИСТЫЕ 25 000 НАСЕЛЕНИЯ")
            render_counter_cards(self)
            return
        else:
            self.battle_scan_area.pack_forget()
            self.battle_tree.pack_forget()
            self.battle_counter_cards.pack_forget()
            if not self.battle_planet_cards.winfo_manager():
                self.battle_planet_cards.pack(fill="x", expand=True)
            if not self.battle_results_shell.winfo_manager():
                self.battle_results_shell.pack(fill="both", expand=True)
            self.battle_result_title_var.set("ТОП‑7 ПЛАНЕТНЫХ СБОРОК · ПРОВЕРЕНО СИМУЛЯТОРОМ ПРОТИВ 3 РАС")
            render_planet_cards(self)
            return
        population_limit = 25_000 if self.battle_result_kind == "counter" else self._battle_budget()
        for plan in plans:
            fleet = "\n".join(f"{name} × {count:,}".replace(",", " ") for name, count in plan.ships.items())
            counters = "\n".join(plan.counters + plan.warnings + plan.enemy_ability_notes) or "базовые статы и контр‑профиль"
            abilities = "\n".join(plan.ability_notes) or "нет численно применимого эффекта"
            self.battle_tree.insert("", "end", values=(
                f"#{plan.rank}", plan.title, f"{plan.population:,} / {population_limit:,}".replace(",", " "),
                    fleet, counters, abilities,
            ))

    def build_battle_page(self: Any) -> None:
        tk, ttk = app_module.tk, app_module.ttk
        page = self._new_page("battle")
        self.battle_capacity_var = tk.IntVar(value=25_000)
        self.battle_reserve_var = tk.IntVar(value=1_600)
        self.battle_planet_reserve_var = tk.IntVar(value=1_600)
        self.battle_own_level_var = tk.IntVar(value=10)
        self.battle_include_defence_var = tk.BooleanVar(value=True)
        self.battle_enemy_race_var = tk.StringVar(value="Авто")
        self.battle_scan: EnemyScan | None = None
        self.battle_plans: list[CounterPlan] = []
        self.battle_result_kind = "none"
        self.battle_planet_expanded: set[int] = set()
        self.battle_counter_expanded: set[int] = set()
        toolbar = tk.Frame(page, bg=app_module.BG)
        toolbar.pack(fill="x", pady=(0, 10))
        app_module.make_button(
            toolbar, "Запустить проверочные симуляции", self.battle_run_verification_campaign, "success",
        ).pack(side="left")
        app_module.make_button(toolbar, "Контр‑флот", self.battle_show_counter_mode, "primary").pack(side="left")
        app_module.make_button(toolbar, "Топ‑7 для планет", self.battle_planet_calculate, "secondary").pack(side="left", padx=8)
        app_module.make_button(toolbar, "Перепроверить топ‑7", lambda: self.battle_planet_calculate(force=True), "secondary").pack(side="left")
        app_module.make_button(toolbar, "Журнал симуляций", self.battle_open_simulation_log, "secondary").pack(side="left", padx=8)
        tk.Label(toolbar, text="Мой уровень", bg=app_module.BG, fg=app_module.MUTED).pack(side="left", padx=(12, 5))
        tk.Spinbox(toolbar, from_=0, to=20, textvariable=self.battle_own_level_var, width=4,
                   bg=app_module.INPUT, fg=app_module.TEXT, insertbackground=app_module.TEXT).pack(side="left")
        tk.Label(toolbar, text="Раса врага", bg=app_module.BG, fg=app_module.MUTED).pack(side="left", padx=(14, 5))
        enemy_race_box = ttk.Combobox(toolbar, textvariable=self.battle_enemy_race_var, state="readonly", width=14,
                                      values=("Авто", "Конфедерация", "Тертеты", "Ноксы"))
        enemy_race_box.pack(side="left")
        tk.Label(toolbar, text="Гражданское население", bg=app_module.BG, fg=app_module.MUTED).pack(side="left", padx=(18, 5))
        tk.Spinbox(toolbar, from_=0, to=24_999, textvariable=self.battle_planet_reserve_var, width=7,
                   bg=app_module.INPUT, fg=app_module.TEXT, insertbackground=app_module.TEXT).pack(side="left")
        self.battle_progress_var = tk.StringVar(value="Симулятор ещё не запускался.")
        tk.Label(page, textvariable=self.battle_progress_var, bg=app_module.PANEL_ALT, fg=app_module.MUTED,
                 anchor="w", padx=14, pady=7, font=("Segoe UI", 9)).pack(fill="x", pady=(0, 8))
        self.battle_scan_area = tk.Frame(page, bg=app_module.BG)
        self.battle_scan_area.pack(fill="x", pady=(0, 8))
        note = tk.Label(
            self.battle_scan_area,
            text=("Вставь текст разведки: например «Немезис: 120», «Голиаф — 20». "
                  "«Подобрать 5» всегда использует чистые 25 000 населения. В «Топ‑7 для планет» общий гражданский "
                  "резерв задаётся сверху; карточки свёрнуты — нажми на нужную, чтобы раскрыть состав.\n"
                  "Кнопка «Проверить и подобрать топ‑5» запускает реальные бои в игровом симуляторе: твои технологии, "
                  "командные корабли, их уровни и приоритет зеркалятся противнику. Состав врага берётся из текста; "
                  "уровень 10 — значение по умолчанию. Если названия пересекаются (например, «Бомбардировщик»), "
                  "выбери расу врага сверху. Программа закрывает только созданные ею вкладки отчётов. "
                  "«Топ‑7 для планет» проверяет постоянные флоты против броневой, тяжёлой и смешанной сборок "
                  "Конфедерации, Тертетов и Ноксов; капитальные корабли в этих боях исключены. "
                  "«Запустить проверочные симуляции» запускает подготовленный пакет по всем 12 обычным слотам "
                  "текущей атакующей расы, количествам, уровням, командирам и обороне; все технологии и снаряжение "
                  "принудительно обнуляются, а полные отчёты сохраняются без ограничения количества."),
            justify="left", wraplength=1050, bg=app_module.PANEL_ALT, fg=app_module.MUTED, padx=14, pady=10,
        )
        note.pack(fill="x", pady=(0, 10))
        self.battle_input = tk.Text(self.battle_scan_area, height=8, bg=app_module.INPUT, fg=app_module.TEXT,
                                    insertbackground=app_module.TEXT, relief="flat", padx=12, pady=10,
                                    font=("Consolas", 10))
        self.battle_input.pack(fill="x", pady=(0, 8))

        def paste_reconnaissance(event: Any = None) -> str:
            """Keep Ctrl+V working even if an outer widget consumes the default binding."""
            try:
                value = self.clipboard_get()
            except tk.TclError:
                return "break"
            widget = event.widget if event is not None else self.battle_input
            try:
                widget.delete("sel.first", "sel.last")
            except tk.TclError:
                pass
            widget.insert("insert", value)
            return "break"

        def paste_shortcut(event: Any) -> str | None:
            # VK_V is 86 on Windows.  Checking it also covers Ctrl+V when the
            # current keyboard layout reports the Russian letter «м» instead.
            if event.keycode == 86 or event.keysym.lower() in {"v", "cyrillic_em"}:
                return paste_reconnaissance(event)
            return None

        self.battle_input.bind("<<Paste>>", paste_reconnaissance)
        self.battle_input.bind("<Control-v>", paste_reconnaissance)
        self.battle_input.bind("<Control-V>", paste_reconnaissance)
        self.battle_input.bind("<Control-Key>", paste_shortcut, add="+")
        self.battle_parsed_var = tk.StringVar(value="Вставь разведку и нажми «Подобрать 5 контр-вариантов».")
        tk.Label(self.battle_scan_area, textvariable=self.battle_parsed_var, bg=app_module.PANEL, fg=app_module.TEXT,
                 anchor="w", padx=14, pady=9, font=("Segoe UI", 9)).pack(fill="x", pady=(0, 8))
        scan_actions = tk.Frame(self.battle_scan_area, bg=app_module.BG)
        scan_actions.pack(anchor="w", pady=(0, 8))
        app_module.make_button(scan_actions, "Вставить из буфера", paste_reconnaissance, "secondary").pack(side="left")
        app_module.make_button(
            scan_actions, "Проверить и подобрать топ‑5", self.battle_calculate, "primary",
        ).pack(side="left", padx=(8, 0))
        tk.Checkbutton(
            scan_actions, text="Учитывать оборону", variable=self.battle_include_defence_var,
            bg=app_module.BG, fg=app_module.TEXT, activebackground=app_module.BG,
            activeforeground=app_module.TEXT, selectcolor=app_module.INPUT,
        ).pack(side="left", padx=(18, 4))
        app_module.make_button(
            scan_actions, "Рассчитать волны", self.battle_calculate_waves, "secondary",
        ).pack(side="left")
        self.battle_result_title_var = tk.StringVar(value="РЕЗУЛЬТАТ")
        self.battle_result_title_label = tk.Label(page, textvariable=self.battle_result_title_var, bg=app_module.BG, fg=app_module.ACCENT,
                                                  anchor="w", font=("Segoe UI Semibold", 9))
        self.battle_result_title_label.pack(fill="x", pady=(0, 4))
        style = ttk.Style(self)
        style.configure("Battle.Treeview", background=app_module.PANEL, fieldbackground=app_module.PANEL,
                        foreground=app_module.TEXT, rowheight=82, borderwidth=0, font=("Segoe UI", 9))
        style.configure("Battle.Treeview.Heading", background=app_module.PANEL_ALT, foreground=app_module.MUTED,
                        relief="flat", font=("Segoe UI Semibold", 9), padding=(9, 10))
        style.map("Battle.Treeview", background=[("selected", app_module.ACCENT)], foreground=[("selected", app_module.TEXT)])
        self.battle_tree = ttk.Treeview(page, columns=("rank", "title", "population", "fleet", "counter", "ability"),
                                        show="headings", style="Battle.Treeview")
        headings = (("rank", "Топ"), ("title", "Подход"), ("population", "Население"),
                    ("fleet", "Состав атакующей расы"), ("counter", "Контр‑связки"), ("ability", "Спецумения"))
        widths = {"rank": 45, "title": 160, "population": 110, "fleet": 220, "counter": 260, "ability": 280}
        for key, text in headings:
            self.battle_tree.heading(key, text=text)
            self.battle_tree.column(key, width=widths[key], minwidth=widths[key], anchor="w")
        self.battle_tree.pack(fill="both", expand=True)
        self.battle_results_shell = tk.Frame(page, bg=app_module.BG)
        self.battle_results_canvas = tk.Canvas(self.battle_results_shell, bg=app_module.BG, highlightthickness=0, bd=0)
        result_scrollbar = ttk.Scrollbar(self.battle_results_shell, orient="vertical", command=self.battle_results_canvas.yview)
        self.battle_results_canvas.configure(yscrollcommand=result_scrollbar.set)
        self.battle_results_canvas.pack(side="left", fill="both", expand=True)
        result_scrollbar.pack(side="right", fill="y")
        self.battle_results_host = tk.Frame(self.battle_results_canvas, bg=app_module.BG)
        self.battle_results_window = self.battle_results_canvas.create_window((0, 0), window=self.battle_results_host, anchor="nw")
        self.battle_results_host.bind(
            "<Configure>", lambda _: self.battle_results_canvas.configure(scrollregion=self.battle_results_canvas.bbox("all")),
        )
        self.battle_results_canvas.bind(
            "<Configure>", lambda event: self.battle_results_canvas.itemconfigure(self.battle_results_window, width=event.width),
        )
        self.battle_results_canvas.bind("<MouseWheel>", lambda event: self.battle_results_canvas.yview_scroll(-int(event.delta / 120), "units"))
        self.battle_results_host.columnconfigure(0, weight=1)
        self.battle_counter_cards = tk.Frame(self.battle_results_host, bg=app_module.BG)
        self.battle_counter_cards.grid_columnconfigure(0, weight=1)
        self.battle_planet_cards = tk.Frame(self.battle_results_host, bg=app_module.BG)
        self.battle_planet_cards.grid_columnconfigure(0, weight=1)

    def battle_budget(self: Any) -> int:
        return max(0, int(self.battle_capacity_var.get()) - max(0, int(self.battle_reserve_var.get())))

    def battle_calculate(self: Any) -> None:
        text = self.battle_input.get("1.0", "end-1c")
        chosen_race = str(self.battle_enemy_race_var.get() or "Авто")
        try:
            scan = parse_enemy_scan(text, None if chosen_race == "Авто" else chosen_race)
            selected_race_id = RACE_SELECTION_IDS.get(chosen_race)
            enemy_race_id = _scan_race_id(scan, selected_race_id)
        except (TypeError, ValueError) as exc:
            app_module.messagebox.showerror(app_module.APP_NAME, str(exc))
            return
        own_level = int(self.battle_own_level_var.get())

        def progress(done: int, total: int, current: str) -> None:
            self.after(0, lambda: self.battle_progress_var.set(
                f"Контр‑флот: проверено {done} из {total} · осталось {total - done} · {current}"
            ))

        async def operation() -> list[SimulatorResult]:
            await self.worker.connect(self.endpoint())
            return await _run_simulator_candidates(
                self.worker, scan, own_level=own_level, run_kind="counter", progress=progress,
                enemy_race_id=enemy_race_id,
            )

        def success(results: list[SimulatorResult]) -> None:
            self.battle_scan = scan
            self.battle_plans = results
            self.battle_result_kind = "counter"
            self.battle_counter_expanded.clear()
            won = sum(1 for result in results if result.won)
            self.battle_parsed_var.set(
                f"Проверено реальным симулятором: {len(results)} лучших из серии; побед атакующего: {won}."
            )
            self.battle_progress_var.set("Контр‑флот: серия завершена; все отчёты сохранены в журнале.")
            render_battle(self)

        self.battle_progress_var.set("Контр‑флот: подготовка симулятора…")
        self.run_task(operation(), "Симулятор: проверка составов…", success)

    def battle_calculate_waves(self: Any) -> None:
        """Find sequential 25k waves using only the game's battle reports."""
        text = self.battle_input.get("1.0", "end-1c")
        chosen_race = str(self.battle_enemy_race_var.get() or "Авто")
        try:
            scan = parse_enemy_scan(text, None if chosen_race == "Авто" else chosen_race)
            selected_race_id = RACE_SELECTION_IDS.get(chosen_race)
            enemy_race_id = _scan_race_id(scan, selected_race_id)
            if not scan.ships and not scan.defence:
                raise ValueError("Не распознаны ни корабли, ни оборона противника.")
        except (TypeError, ValueError) as exc:
            app_module.messagebox.showerror(app_module.APP_NAME, str(exc))
            return
        own_level = int(self.battle_own_level_var.get())
        include_defence = bool(self.battle_include_defence_var.get())

        async def operation() -> list[SimulatorResult]:
            await self.worker.connect(self.endpoint())
            sim_page = await self.worker._ensure_fleets_page()
            attacker_race_id = int(await sim_page.evaluate(
                "() => Number(document.querySelector('#choose_race1')?.value || 1)"
            ))
            if attacker_race_id not in (1, 2, 3):
                attacker_race_id = 1
            ships, commanders = dict(scan.ships), dict(scan.commanders)
            defence = dict(scan.defence) if include_defence else {}
            waves: list[SimulatorResult] = []
            for index in range(1, 13):
                state = EnemyScan(ships, dict(scan.levels), (), commanders, defence)
                candidates = build_simulator_candidates(state, own_level=own_level, race_id=attacker_race_id)
                reports = await _run_simulator_candidates(
                    self.worker, None, own_level=own_level, candidates_override=candidates,
                    scenarios=[SimulatorScenario(f"Волна {index}", enemy_race_id, ships, scan.levels, commanders, defence)],
                    candidate_limit=len(candidates), rank_results=False, run_kind="wave",
                    progress=lambda done, total, current, wave=index: self.after(0, lambda: self.battle_progress_var.set(
                        f"Волна {wave}: проверено {done}/{total} · {current}"
                    )), enemy_race_id=enemy_race_id,
                )
                best = min(
                    reports,
                    key=lambda item: (
                        (item.defender_population if item.defender_population is not None else 10**9)
                        + (item.defender_defence_population if item.defender_defence_population is not None else 0),
                        -(item.attacker_population or 0),
                    ),
                )
                best = replace(best, title=f"Волна {index} · {best.title}")
                waves.append(best)
                next_ships = dict(best.remaining_ships)
                next_commanders = {
                    name: (count, scan.commanders.get(name, (count, 10))[1])
                    for name, count in best.remaining_commanders.items()
                }
                next_defence = dict(best.remaining_defence) if include_defence else {}
                if not next_ships and not next_commanders and not next_defence:
                    if (best.defender_population or 0) > 0 or (best.defender_defence_population or 0) > 0:
                        raise BrowserAutomationError("Симулятор вернул население противника, но не дал читаемый состав остатков. План волн остановлен безопасно.")
                    break
                if (next_ships, next_commanders, next_defence) == (ships, commanders, defence):
                    break
                ships, commanders, defence = next_ships, next_commanders, next_defence
            return waves

        def success(waves: list[SimulatorResult]) -> None:
            self.battle_scan = scan
            self.battle_plans = waves
            self.battle_result_kind = "waves"
            self.battle_counter_expanded = set(range(len(waves)))
            self.battle_result_title_var.set("ВОЛНЫ ВСКРЫТИЯ · КАЖДАЯ ДО 25 000 НАСЕЛЕНИЯ")
            self.battle_progress_var.set(f"Волны вскрытия: готово {len(waves)}. Оборона: {'учтена' if include_defence else 'не учтена'}.")
            render_battle(self)

        self.battle_progress_var.set("Волны вскрытия: подготовка первой волны…")
        self.run_task(operation(), "Симулятор: расчёт последовательных волн…", success)

    def battle_show_counter_mode(self: Any) -> None:
        """Open the reconnaissance input before attempting a counter calculation."""
        self.battle_result_kind = "counter"
        self.battle_planet_cards.pack_forget()
        self.battle_tree.pack_forget()
        self.battle_counter_cards.pack_forget()
        if not self.battle_scan_area.winfo_manager():
            self.battle_scan_area.pack(fill="x", pady=(0, 8), before=self.battle_result_title_label)
        self.battle_result_title_var.set("КОНТР‑ФЛОТ · ВСТАВЬ РАЗВЕДКУ НИЖЕ И НАЖМИ «ПОДОБРАТЬ 5»")
        self.battle_input.focus_set()

    def battle_planet_calculate(self: Any, force: bool = False) -> None:
        try:
            reserve = int(self.battle_planet_reserve_var.get())
            if reserve < 0 or reserve >= 25_000:
                raise ValueError("Гражданское население должно быть от 0 до 24 999.")
        except (TypeError, ValueError) as exc:
            app_module.messagebox.showerror(app_module.APP_NAME, str(exc))
            return
        combat_limit = 25_000 - reserve
        own_level = int(self.battle_own_level_var.get())
        scenarios = build_planet_scenarios(combat_limit)
        expected_trials = len(build_planet_candidates(combat_limit)) * len(scenarios)

        def progress(done: int, total: int, current: str) -> None:
            self.after(0, lambda: self.battle_progress_var.set(
                f"Топ‑7: проверено {done} из {total} · осталось {total - done} · {current}"
            ))

        async def operation() -> tuple[list[CounterPlan], bool, int]:
            await self.worker.connect(self.endpoint())
            sim_page = await self.worker._ensure_fleets_page()
            attacker_race_id = int(await sim_page.evaluate(
                "() => Number(document.querySelector('#choose_race1')?.value || 1)"
            ))
            if attacker_race_id not in (1, 2, 3):
                attacker_race_id = 1
            cached = None if force else load_planet_cache(combat_limit, own_level, attacker_race_id)
            if cached is not None:
                return ([_battle_plan_from_cache(dict(row)) for row in cached["plans"]], True, attacker_race_id)
            candidates = build_planet_candidates(combat_limit, race_id=attacker_race_id)
            if not candidates:
                raise BrowserAutomationError(f"Для расы атакующего {attacker_race_id} не собраны постоянные флоты")
            reports = await _run_simulator_candidates(
                self.worker, None, own_level=own_level, candidates_override=candidates, scenarios=scenarios,
                candidate_limit=len(candidates), rank_results=False, run_kind="planet", progress=progress,
            )
            grouped: dict[str, list[tuple[str, SimulatorResult]]] = {}
            for report in reports:
                grouped.setdefault(report.title, []).append((report.scenario, report))
            plans = rank_planet_trials(candidates, grouped, top_n=7)
            save_planet_cache(
                combat_limit, own_level, [_battle_plan_to_cache(plan) for plan in plans], attacker_race_id,
            )
            return plans, False, attacker_race_id

        def success(result: tuple[list[CounterPlan], bool, int]) -> None:
            plans, from_cache, attacker_race_id = result
            self.battle_scan = None
            self.battle_plans = plans
            self.battle_planet_expanded.clear()
            self.battle_result_kind = "planet"
            if from_cache:
                self.battle_progress_var.set(
                    f"Топ‑7: показан сохранённый результат для расы {RACE_LABELS.get(attacker_race_id, attacker_race_id)} "
                    f"и лимита {combat_limit:,}. Для нового прогона нажми «Перепроверить топ‑7».".replace(",", " ")
                )
            else:
                self.battle_progress_var.set(
                    f"Топ‑7: серия завершена · {expected_trials} боёв сохранено. "
                    "Повторное нажатие покажет этот кэш мгновенно."
                )
            render_battle(self)

        self.battle_progress_var.set(f"Топ‑7: подготовка · 0 из {expected_trials} боёв…")
        self.run_task(
            operation(), f"Симулятор: {expected_trials} боёв для топ‑7…", success,
        )

    def patched_build_shell(self: Any) -> None:
        original_build_shell(self)
        queue_button = self.nav_buttons["queue"]
        nav_group = queue_button.master.master
        base_bg = str(queue_button.cget("bg"))
        active_bg = str(queue_button.cget("activebackground"))
        base_fg = str(queue_button.cget("fg"))
        active_fg = str(queue_button.cget("activeforeground"))
        row = app_module.tk.Frame(nav_group, bg=base_bg)
        row.pack(fill="x", padx=10, pady=2, before=queue_button.master)
        rail = app_module.tk.Frame(row, bg=base_bg, width=3, height=31)
        rail.pack(side="left", fill="y")
        button = app_module.tk.Button(row, text="⚔  Бой", anchor="w", command=lambda: self.show_page("battle"),
                                      bg=base_bg, fg=base_fg, activebackground=active_bg, activeforeground=active_fg,
                                      relief="flat", bd=0, padx=14, pady=9, cursor="hand2", highlightthickness=0,
                                      font=queue_button.cget("font"))
        button.pack(side="left", fill="x", expand=True)
        setattr(button, "_nav_rail", rail)
        self._battle_nav_colors = (base_bg, active_bg, base_fg, active_fg)
        self.nav_buttons["battle"] = button
        build_battle_page(self)

    def patched_show_page(self: Any, key: str) -> None:
        if key != "battle":
            original_show_page(self, key)
            return
        self.current_page = key
        self.page_title_var.set("Бой · контр‑план")
        self.pages[key].tkraise()
        base_bg, active_bg, base_fg, active_fg = self._battle_nav_colors
        for nav_key, button in self.nav_buttons.items():
            selected = nav_key == key
            button.configure(bg=active_bg if selected else base_bg, fg=active_fg if selected else base_fg)
            rail = getattr(button, "_nav_rail", None)
            if rail is not None:
                rail.configure(bg=app_module.ACCENT if selected else base_bg)
        render_battle(self)

    def patched_render_all(self: Any) -> None:
        original_render_all(self)
        render_battle(self)

    app_class._battle_budget = battle_budget
    app_class.battle_calculate = battle_calculate
    app_class.battle_calculate_waves = battle_calculate_waves
    app_class.battle_run_verification_campaign = battle_run_verification_campaign
    app_class.battle_show_counter_mode = battle_show_counter_mode
    app_class.battle_planet_calculate = battle_planet_calculate
    app_class.battle_open_simulation_log = battle_open_simulation_log
    app_class.battle_toggle_planet_card = battle_toggle_planet_card
    app_class.battle_toggle_counter_card = battle_toggle_counter_card
    app_class.battle_open_wave_report = battle_open_wave_report
    app_class._build_shell = patched_build_shell
    app_class.show_page = patched_show_page
    app_class.render_all = patched_render_all
    app_class._battle_feature_installed = True
