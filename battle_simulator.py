"""Small, deterministic helpers for ranking real Nemexia simulator results.

The game simulator remains the source of truth.  This module deliberately does
not try to recreate its undisclosed combat formulas: it only builds a diverse
set of legal blue-race candidates and ranks the reports returned by the game.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import re
from typing import Iterable

from battle_catalog import BLUE_BY_NAME, BLUE_FLEET, ENEMY_FLEET
from battle_engine import CounterPlan, EnemyScan, recommend_counter_fleets


@dataclass(frozen=True, slots=True)
class SimulatorResult:
    title: str
    ships: dict[str, int]
    population: int
    winner: str
    attacker_population: int | None
    defender_population: int | None
    rounds: int
    report_url: str
    scenario: str = ""
    remaining_ships: dict[str, int] = field(default_factory=dict)
    remaining_commanders: dict[str, int] = field(default_factory=dict)
    remaining_defence: dict[str, int] = field(default_factory=dict)
    defender_defence_population: int | None = None
    enemy_race_id: int = 0
    enemy_ships: dict[str, int] = field(default_factory=dict)
    enemy_levels: dict[str, int] = field(default_factory=dict)
    enemy_commanders: dict[str, tuple[int, int]] = field(default_factory=dict)
    enemy_defence: dict[str, int] = field(default_factory=dict)

    @property
    def won(self) -> bool:
        return "атакующ" in self.winner.casefold()


@dataclass(frozen=True, slots=True)
class SimulatorScenario:
    title: str
    race_id: int
    ships: dict[str, int]
    levels: dict[str, int]
    commanders: dict[str, tuple[int, int]] = field(default_factory=dict)
    defence: dict[str, int] = field(default_factory=dict)


def _population(ships: dict[str, int]) -> int:
    return sum(BLUE_BY_NAME[name].population * int(count) for name, count in ships.items())


def _fill(population: int, weights: dict[str, float]) -> dict[str, int]:
    available = [name for name, value in weights.items() if value > 0 and name in BLUE_BY_NAME]
    if not available:
        return {}
    total = sum(weights[name] for name in available)
    result = {
        name: int(population * weights[name] / total / BLUE_BY_NAME[name].population)
        for name in available
    }
    used = _population(result)
    order = sorted(available, key=lambda name: weights[name] / BLUE_BY_NAME[name].population, reverse=True)
    while True:
        name = next((item for item in order if BLUE_BY_NAME[item].population <= population - used), None)
        if name is None:
            break
        result[name] += 1
        used += BLUE_BY_NAME[name].population
    return {name: count for name, count in result.items() if count}


def build_simulator_candidates(scan: EnemyScan, *, own_level: int = 10, capacity: int = 25_000) -> list[CounterPlan]:
    """Produce distinct candidates for the game to test, never a local verdict."""
    # Civilian/support ships and commanders are valid simulator targets but do
    # not have a combat profile in the local heuristic.  Still run real-game
    # tests against them instead of rejecting a perfectly valid reconnaissance.
    try:
        seeds = recommend_counter_fleets(
            scan, capacity=capacity, reserve=0, full_combat_limit=True, own_level=own_level, top_n=7,
        )
    except ValueError:
        seeds = []
    candidates: list[CounterPlan] = list(seeds)
    regular = [ship for ship in BLUE_FLEET if not ship.capital]
    # Six focused fleets plus adjacent two-hull mixes explore a materially
    # different shape than the old static recommendations.
    for index, ship in enumerate(regular):
        composition = _fill(capacity, {ship.name: 1.0})
        candidates.append(CounterPlan(0, f"Проверка: упор в {ship.name}", composition, _population(composition), 0.0, (), (), (), ()))
        partner = regular[(index + 1) % len(regular)]
        composition = _fill(capacity, {ship.name: 0.68, partner.name: 0.32})
        candidates.append(CounterPlan(0, f"Проверка: {ship.name} + {partner.name}", composition, _population(composition), 0.0, (), (), (), ()))
    unique: dict[tuple[tuple[str, int], ...], CounterPlan] = {}
    for candidate in candidates:
        key = tuple(sorted(candidate.ships.items()))
        unique.setdefault(key, candidate)
    return list(unique.values())


def _fill_by_name(population: int, weights: dict[str, float], catalog: dict[str, object]) -> dict[str, int]:
    available = [name for name, weight in weights.items() if weight > 0 and name in catalog]
    if not available:
        return {}
    total = sum(weights[name] for name in available)
    result = {name: int(population * weights[name] / total / getattr(catalog[name], "population")) for name in available}
    used = sum(getattr(catalog[name], "population") * count for name, count in result.items())
    order = sorted(available, key=lambda name: weights[name] / getattr(catalog[name], "population"), reverse=True)
    while True:
        name = next((item for item in order if getattr(catalog[item], "population") <= population - used), None)
        if name is None:
            break
        result[name] += 1
        used += getattr(catalog[name], "population")
    return {name: count for name, count in result.items() if count}


def build_planet_candidates(capacity: int) -> list[CounterPlan]:
    """Distinct permanent blue fleets, all without capital ships."""
    profiles = (
        ("Быстрый первый залп", {"Скаут": 0.35, "Крейсер": 0.45, "Бомбардировщик": 0.20}),
        ("Рой и перехват", {"Скаут": 0.70, "Крейсер": 0.30}),
        ("Крейсерский удар", {"Крейсер": 0.70, "Бомбардировщик": 0.30}),
        ("Плотная оборона", {"Защитник": 0.55, "Боевой корабль": 0.30, "Бомбардировщик": 0.15}),
        ("Броневой кулак", {"Защитник": 0.25, "Боевой корабль": 0.60, "Разрушитель": 0.15}),
        ("Тяжёлый прорыв", {"Разрушитель": 0.62, "Бомбардировщик": 0.38}),
        ("Осадная артиллерия", {"Бомбардировщик": 0.70, "Разрушитель": 0.30}),
        ("Антиброневой контур", {"Крейсер": 0.25, "Боевой корабль": 0.25, "Разрушитель": 0.30, "Бомбардировщик": 0.20}),
        ("Сбалансированный флот", {"Скаут": 0.12, "Крейсер": 0.16, "Защитник": 0.18, "Боевой корабль": 0.19, "Разрушитель": 0.18, "Бомбардировщик": 0.17}),
        ("Гибкая линия", {"Скаут": 0.22, "Защитник": 0.28, "Боевой корабль": 0.25, "Бомбардировщик": 0.25}),
        ("Удар по тяжёлым корпусам", {"Боевой корабль": 0.22, "Разрушитель": 0.46, "Бомбардировщик": 0.32}),
        ("Универсальный резерв", {"Крейсер": 0.18, "Защитник": 0.22, "Боевой корабль": 0.24, "Разрушитель": 0.20, "Бомбардировщик": 0.16}),
    )
    candidates = []
    for title, weights in profiles:
        ships = _fill(capacity, weights)
        candidates.append(CounterPlan(0, title, ships, _population(ships), 0.0, (), (), (), ()))
    return candidates


def fit_candidate_population(candidate: CounterPlan, capacity: int) -> CounterPlan:
    """Keep a fleet's proportions while leaving room for mirrored commanders."""
    if candidate.population <= max(0, capacity):
        return candidate
    weights = {
        name: count * BLUE_BY_NAME[name].population / max(1, candidate.population)
        for name, count in candidate.ships.items()
    }
    ships = _fill(max(0, capacity), weights)
    return CounterPlan(0, candidate.title, ships, _population(ships), candidate.score,
                       candidate.counters, candidate.warnings, candidate.ability_notes, candidate.enemy_ability_notes)


def build_planet_scenarios(capacity: int) -> list[SimulatorScenario]:
    """Twelve standard opponent fleets supplied by the user: four per race."""
    groups = (
        ("Конфедерация", 1, ("Защитник", "Боевой корабль", "Разрушитель", "Бомбардировщик")),
        ("Тертеты", 2, ("Бот Щит", "Звездная Армада", "Голиаф", "БомберБот")),
        ("Ноксы", 3, ("Абсорбатор", "Призрак", "Шмель", "Бомбардировщик")),
    )
    scenarios: list[SimulatorScenario] = []
    enemy_catalogs = {
        2: {ship.name: ship for ship in ENEMY_FLEET if ship.race == "Зелёная"},
        3: {ship.name: ship for ship in ENEMY_FLEET if ship.race == "Красная"},
    }
    for race, race_id, (defender, battle, destroyer, bomber) in groups:
        catalog = BLUE_BY_NAME if race_id == 1 else enemy_catalogs[race_id]
        profiles = (
            ("броневая линия", {defender: 0.34, battle: 0.38, destroyer: 0.12, bomber: 0.16}),
            ("тяжёлый прорыв", {defender: 0.12, battle: 0.20, destroyer: 0.46, bomber: 0.22}),
            ("артиллерийский нажим", {defender: 0.10, battle: 0.15, destroyer: 0.20, bomber: 0.55}),
            ("смешанный постоянный", {defender: 0.25, battle: 0.25, destroyer: 0.25, bomber: 0.25}),
        )
        for role, weights in profiles:
            ships = _fill_by_name(capacity, weights, catalog)
            scenarios.append(SimulatorScenario(f"{race} · {role}", race_id, ships, {name: 10 for name in ships}))
    return scenarios


def rank_planet_trials(
    candidates: Iterable[CounterPlan], trials: dict[str, list[tuple[str, SimulatorResult]]], *, top_n: int = 7,
) -> list[CounterPlan]:
    """Turn actual simulation reports into explanatory permanent-fleet cards."""
    ranked: list[CounterPlan] = []
    for candidate in candidates:
        candidate_trials = trials.get(candidate.title, [])
        wins = [item for item in candidate_trials if item[1].won]
        losses = [item for item in candidate_trials if not item[1].won]
        margins = [
            (result.attacker_population or 0) - (result.defender_population or 0)
            for _, result in candidate_trials
        ]
        score = len(wins) * 1_000_000 + sum(margins)
        best = max(wins or candidate_trials, key=lambda item: ((item[1].attacker_population or 0) - (item[1].defender_population or 0)), default=None)
        counters = (f"Победы в симуляторе: {len(wins)} из {len(candidate_trials)}",)
        if best:
            counters += (f"Лучший результат: {best[0]}",)
        warnings = tuple(f"Слабее против: {name}" for name, _ in losses[:2])
        ranked.append(CounterPlan(0, candidate.title, candidate.ships, candidate.population, score, counters, warnings, (), ()))
    ranked.sort(key=lambda plan: plan.score, reverse=True)
    # The user needs seven useful roles for seven planets, not seven cosmetic
    # variants of the same winning composition.  Keep a clear population-share
    # distance between selected fleets, then fill any remaining places safely.
    names = tuple(BLUE_BY_NAME)
    def distance(left: CounterPlan, right: CounterPlan) -> float:
        return sum(abs(
            left.ships.get(name, 0) * BLUE_BY_NAME[name].population / max(1, left.population)
            - right.ships.get(name, 0) * BLUE_BY_NAME[name].population / max(1, right.population)
        ) for name in names)
    selected: list[CounterPlan] = []
    for plan in ranked:
        if all(distance(plan, existing) >= 0.28 for existing in selected):
            selected.append(plan)
        if len(selected) == top_n:
            break
    if len(selected) < top_n:
        for plan in ranked:
            if plan not in selected:
                selected.append(plan)
            if len(selected) == top_n:
                break
    return [
        CounterPlan(index, plan.title, plan.ships, plan.population, plan.score, plan.counters, plan.warnings, (), ())
        for index, plan in enumerate(selected, start=1)
    ]


def rank_simulator_results(results: Iterable[SimulatorResult], *, top_n: int = 5) -> list[SimulatorResult]:
    """Rank verified reports: victory first, then own survivors, then enemy loss."""
    def key(item: SimulatorResult) -> tuple[int, int, int, int]:
        own = item.attacker_population if item.attacker_population is not None else -1
        enemy = item.defender_population if item.defender_population is not None else 10**9
        return (int(item.won), own, -enemy, -item.rounds)

    return sorted(results, key=key, reverse=True)[:top_n]


def parse_report_summary(text: str) -> tuple[str, int | None, int | None, int]:
    """Extract stable text facts from the simulator's report page."""
    clean = " ".join(str(text or "").replace("\xa0", " ").split())
    winner_match = re.search(r"(Атакующ\w*\s+победител\w*|Защитник\w*\s+победител\w*|Ничья)", clean, re.I)
    winner = winner_match.group(1) if winner_match else "Не определён"
    attacker_match = re.search(r"Атакующ\w*.{0,180}?Корабли\s*:?\s*([\d\s,]+)", clean, re.I)
    defender_match = re.search(r"Защитник\w*.{0,180}?Корабли\s*:?\s*([\d\s,]+)", clean, re.I)
    # The opening summary contains the initial population.  Prefer the explicit
    # final section: it is the only value suitable for choosing the next wave.
    final_attacker_match = re.search(
        r"\u041e\u0441\u0442\u0430\u0432\u0448\u0430\u044f\u0441\u044f\s+\u043f\u043e\u043f\u0443\u043b\u044f\u0446\u0438\u044f\s*:\s*\u0410\u0442\u0430\u043a\u0443\u044e\u0449\w*.*?\u041a\u043e\u0440\u0430\u0431\u043b\u0438\s*:?\s*([\d\s,]+)",
        clean, re.I,
    )
    final_defender_match = re.search(
        r"\u041e\u0441\u0442\u0430\u0432\u0448\u0430\u044f\u0441\u044f\s+\u043f\u043e\u043f\u0443\u043b\u044f\u0446\u0438\u044f\s*:\s*\u0417\u0430\u0449\u0438\u0442\u043d\u0438\u043a\w*.*?\u041a\u043e\u0440\u0430\u0431\u043b\u0438\s*:?\s*([\d\s,]+)",
        clean, re.I,
    )
    attacker_match = final_attacker_match or attacker_match
    defender_match = final_defender_match or defender_match
    number = lambda match: int(re.sub(r"\D", "", match.group(1))) if match and re.sub(r"\D", "", match.group(1)) else None
    return winner, number(attacker_match), number(defender_match), len(re.findall(r"Раунд\s+\d+", clean, re.I))
