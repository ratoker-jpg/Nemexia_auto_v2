"""Pure, explainable heuristic for Nemexia counter-fleet suggestions."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from itertools import combinations
from typing import Iterable

from battle_catalog import (
    BLUE_BY_NAME, BLUE_FLEET, COMMANDER_SLOTS, ENEMY_FLEET,
    SIMULATOR_SUPPORT_SHIPS, ShipSpec,
)


def _normal(value: str) -> str:
    return " ".join(value.casefold().replace("ё", "е").split())


ALIASES: dict[str, ShipSpec] = {}
for _ship in ENEMY_FLEET + BLUE_FLEET:
    # Keep red Bomber for the ambiguous Russian spelling when the source has no
    # race context; aliases still make the intended non-Russian names explicit.
    ALIASES.setdefault(_normal(_ship.name), _ship)
    for _alias in _ship.aliases:
        ALIASES.setdefault(_normal(_alias), _ship)


RACE_ALIASES = {
    "Конфедерация": BLUE_FLEET,
    "Тертеты": tuple(ship for ship in ENEMY_FLEET if ship.race == "Зелёная"),
    "Ноксы": tuple(ship for ship in ENEMY_FLEET if ship.race == "Красная"),
}


def _aliases_for_race(race: str | None) -> dict[str, ShipSpec]:
    if not race or race == "Авто":
        return ALIASES
    ships = RACE_ALIASES.get(race)
    if ships is None:
        raise ValueError("Неизвестная раса. Выбери «Авто», «Конфедерация», «Тертеты» или «Ноксы».")
    aliases: dict[str, ShipSpec] = {}
    for ship in ships:
        aliases.setdefault(_normal(ship.name), ship)
        for alias in ship.aliases:
            aliases.setdefault(_normal(alias), ship)
    return aliases


@dataclass(frozen=True, slots=True)
class EnemyScan:
    ships: dict[str, int]
    levels: dict[str, int]
    unknown_lines: tuple[str, ...]
    # Commander ships live in separate simulator controls.  Keep their exact
    # count and level instead of treating them as ordinary fleet hulls.
    commanders: dict[str, tuple[int, int]] = field(default_factory=dict)
    defence: dict[str, int] = field(default_factory=dict)


DEFENCE_ALIASES = {
    "\u0431\u0430\u043b\u043b\u0438\u0441\u0442\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430": "\u0411\u0430\u043b\u043b\u0438\u0441\u0442\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430",
    "\u043b\u0430\u0437\u0435\u0440\u043d\u0430\u044f \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430": "\u041b\u0430\u0437\u0435\u0440\u043d\u0430\u044f \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430",
    "\u0438\u043e\u043d\u043d\u0430\u044f \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430": "\u0418\u043e\u043d\u043d\u0430\u044f \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430",
    "\u043f\u043b\u0430\u0437\u043c\u0435\u043d\u0430\u044f \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430": "\u041f\u043b\u0430\u0437\u043c\u0435\u043d\u0430\u044f \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430",
    "\u0431\u0430\u0448\u0435\u043d\u043d\u044b\u0439 \u0449\u0438\u0442": "\u0411\u0430\u0448\u0435\u043d\u043d\u044b\u0439 \u0449\u0438\u0442",
    "\u043f\u043b\u0430\u043d\u0435\u0442\u0430\u0440\u043d\u044b\u0439 \u0449\u0438\u0442": "\u041f\u043b\u0430\u043d\u0435\u0442\u0430\u0440\u043d\u044b\u0439 \u0449\u0438\u0442",
    "\u043b\u0430\u0437\u0435\u0440-\u0438\u043e\u043d\u043d\u0430\u044f \u0431\u0430\u0442\u0430\u0440\u0435\u044f": "\u041b\u0430\u0437\u0435\u0440-\u0418\u043e\u043d\u043d\u0430\u044f \u0411\u0430\u0442\u0430\u0440\u0435\u044f",
    "\u043f\u043b\u0430\u0437\u043c\u0430-\u043b\u0430\u0437\u0435\u0440\u043d\u0430\u044f \u0431\u0430\u0442\u0430\u0440\u0435\u044f": "\u041f\u043b\u0430\u0437\u043c\u0430-\u041b\u0430\u0437\u0435\u0440\u043d\u0430\u044f \u0411\u0430\u0442\u0430\u0440\u0435\u044f",
    "\u0438\u043e\u043d-\u043f\u043b\u0430\u0437\u043c\u0435\u043d\u043d\u0430\u044f \u0431\u0430\u0442\u0430\u0440\u0435\u044f": "\u0418\u043e\u043d-\u041f\u043b\u0430\u0437\u043c\u0435\u043d\u043d\u0430\u044f \u0411\u0430\u0442\u0430\u0440\u0435\u044f",
}

# Non-combat hulls still change the simulator result and must never be dropped
# from a pasted reconnaissance report.  They intentionally remain outside
# ``ALIASES`` so they do not distort the counter-fleet heuristic.
SUPPORT_SHIP_ALIASES = {_normal(name): name for name in SIMULATOR_SUPPORT_SHIPS}


@dataclass(frozen=True, slots=True)
class CounterPlan:
    rank: int
    title: str
    ships: dict[str, int]
    population: int
    score: float
    counters: tuple[str, ...]
    warnings: tuple[str, ...]
    ability_notes: tuple[str, ...]
    enemy_ability_notes: tuple[str, ...]


def parse_enemy_scan(text: str, race: str | None = None) -> EnemyScan:
    """Parse common ``Ship: 123`` and ``123 Ship`` reconnaissance text."""
    aliases = _aliases_for_race(race)
    found: dict[str, int] = {}
    normalized_text = text.replace("×", "x").replace("х", "x")
    for alias, ship in sorted(aliases.items(), key=lambda item: len(item[0]), reverse=True):
        escaped = re.escape(alias).replace(r"\ ", r"\s+")
        patterns = (
            rf"(?im)(?:^|[;|\n])\s*{escaped}\s*(?:[:=\-–—]\s*|[xX]\s*)?([\d .,]+)",
            rf"(?im)(?:^|[;|\n])\s*([\d .,]+)\s*[xX]?\s*{escaped}(?=\s|$|[,;|])",
        )
        for pattern in patterns:
            for match in re.finditer(pattern, normalized_text):
                count = int(re.sub(r"\D", "", match.group(1)) or "0")
                if count:
                    found[ship.name] = max(found.get(ship.name, 0), count)
    # A remembered race selection must not silently erase a pasted report from
    # another race.  Fall back to the complete catalog; the caller will then
    # infer the race from the actual recognised hulls.
    if not found and race and race != "Авто":
        aliases = ALIASES
        for alias, ship in sorted(aliases.items(), key=lambda item: len(item[0]), reverse=True):
            escaped = re.escape(alias).replace(r"\ ", r"\s+")
            patterns = (
                rf"(?im)(?:^|[;|\n])\s*{escaped}\s*(?:[:=\-–—]\s*|[xX]\s*)?([\d .,]+)",
                rf"(?im)(?:^|[;|\n])\s*([\d .,]+)\s*[xX]?\s*{escaped}(?=\s|$|[,;|])",
            )
            for pattern in patterns:
                for match in re.finditer(pattern, normalized_text):
                    count = int(re.sub(r"\D", "", match.group(1)) or "0")
                    if count:
                        found[ship.name] = max(found.get(ship.name, 0), count)
    for alias, name in sorted(SUPPORT_SHIP_ALIASES.items(), key=lambda item: len(item[0]), reverse=True):
        escaped = re.escape(alias).replace(r"\ ", r"\s+")
        for pattern in (
            rf"(?im)(?:^|[;|\n])\s*{escaped}\s*(?:[:=\-–—]\s*|[xX]\s*)?([\d .,]+)",
            rf"(?im)(?:^|[;|\n])\s*([\d .,]+)\s*[xX]?\s*{escaped}(?=\s|$|[,;|])",
        ):
            for match in re.finditer(pattern, normalized_text):
                count = int(re.sub(r"\D", "", match.group(1)) or "0")
                if count:
                    found[name] = max(found.get(name, 0), count)
    levels: dict[str, int] = {}
    for line in text.splitlines():
        normalized_line = _normal(line)
        level_match = re.search(r"(?:на\s+)?ур(?:овне|овень|\.?)\s*(\d+)", normalized_line, flags=re.IGNORECASE)
        if not level_match:
            continue
        for alias, ship in aliases.items():
            if alias in normalized_line:
                levels[ship.name] = int(level_match.group(1))
                break
    commander_aliases = {_normal(name): (name, slot) for name, slot in COMMANDER_SLOTS.items()}
    commanders: dict[str, tuple[int, int]] = {}
    for line in text.splitlines():
        normalized_line = _normal(line)
        for alias, (name, _slot) in commander_aliases.items():
            if alias not in normalized_line:
                continue
            numbers = [int(value) for value in re.findall(r"\d+", normalized_line)]
            if not numbers:
                continue
            level_match = re.search(r"(?:\u043d\u0430\s+)?\u0443\u0440(?:\u043e\u0432\u043d\u0435|\u043e\u0432\u0435\u043d\u044c|\.?)\s*(\d+)", normalized_line, flags=re.IGNORECASE)
            commanders[name] = (numbers[0], int(level_match.group(1)) if level_match else 10)
            break
    unknown = []
    for line in text.splitlines():
        compact = " ".join(line.split())
        if (
            re.search(r"\d", compact)
            and not any(alias in _normal(compact) for alias in aliases)
            and not any(alias in _normal(compact) for alias in commander_aliases)
            and not any(alias in _normal(compact) for alias in DEFENCE_ALIASES)
        ):
            unknown.append(compact)
    defence: dict[str, int] = {}
    for line in text.splitlines():
        normalized_line = _normal(line)
        for alias, name in DEFENCE_ALIASES.items():
            if alias in normalized_line:
                values = re.findall(r"\d+", normalized_line)
                if values:
                    defence[name] = max(defence.get(name, 0), int(values[0]))
                break
    return EnemyScan(found, levels, tuple(dict.fromkeys(unknown)), commanders, defence)


def level_effectiveness(level: int | None) -> float:
    """User rule: level 10 = 100%, each level changes effectiveness by 5%."""
    safe_level = 10 if level is None else max(0, int(level))
    return max(0.05, 0.50 + safe_level * 0.05)


def _enemy_weight(ship: ShipSpec, count: int, level: int | None) -> float:
    # Attack matters more than life for a counter recommendation, while life
    # prevents paper-thin enemy units from dominating merely by count.
    attack = float(ship.attack)
    life = float(ship.life)
    efficiency = level_effectiveness(level)
    if ship.ability == "Сокрушение":
        chance = min(ship.ability_chance_cap, count * ship.ability_chance_rate) * efficiency
        attack *= 1 + 1.25 * chance  # 2–2.5× attack when it triggers.
    elif ship.ability == "Мега сила":
        bonus = min(ship.ability_cap, count * ship.ability_rate) * efficiency
        chance = min(ship.ability_chance_cap, count * ship.ability_chance_rate) * efficiency
        attack *= 1 + bonus * chance
    elif ship.ability == "Бонусные жизни":
        life *= 1 + min(ship.ability_cap, count * ship.ability_rate) * efficiency
    elif ship.ability == "Улучшенная броня":
        # Armour's exact damage-reduction formula is undisclosed; life receives
        # only a conservative partial proxy rather than a fictional exact value.
        life *= 1 + min(ship.ability_cap, count * ship.ability_rate) * efficiency * 0.35
    elif ship.ability == "Заморажение":
        chance = min(ship.ability_chance_cap, count * ship.ability_chance_rate) * efficiency
        attack *= 1 + chance * 0.25
    return count * (attack + life * 0.12) * level_effectiveness(level)


def _ship_efficiency(own: ShipSpec, enemies: Iterable[tuple[ShipSpec, int, int | None]], own_level: int) -> tuple[float, tuple[str, ...], tuple[str, ...]]:
    score = 0.0
    counters: list[str] = []
    warnings: list[str] = []
    for enemy, count, level in enemies:
        modifier = 1.0
        if enemy.name in own.bonus:
            modifier += 0.70
            counters.append(f"+70% против {enemy.name}")
        if enemy.name in own.penalty:
            modifier -= 0.30
            warnings.append(f"−30% против {enemy.name}")
        if enemy.name in own.priority:
            modifier += 0.18
            counters.append(f"приоритет: {enemy.name}")
        score += _enemy_weight(enemy, count, level) * modifier
    # Durability has deliberately modest influence: the combat engine's actual
    # targeting/round formula is not public in the supplied pages.
    base = own.attack + own.life * 0.14
    return (base * level_effectiveness(own_level) * score / max(1, own.population), tuple(dict.fromkeys(counters)), tuple(dict.fromkeys(warnings)))


def _enemy_ability_notes(enemies: Iterable[tuple[ShipSpec, int, int | None]]) -> tuple[str, ...]:
    notes: list[str] = []
    for ship, count, level in enemies:
        if not ship.ability:
            continue
        detail = ship.ability
        efficiency = level_effectiveness(level)
        if ship.ability_chance_rate:
            chance = min(ship.ability_chance_cap, count * ship.ability_chance_rate) * efficiency
            detail += f" до {chance:.0%}"
        elif ship.ability_rate:
            bonus = min(ship.ability_cap, count * ship.ability_rate) * efficiency
            detail += f" до +{bonus:.0%}"
        notes.append(f"враг {ship.name} ур. {level or 10}: «{detail}»")
    return tuple(notes)


def _allocate(capacity: int, weights: dict[str, float]) -> dict[str, int]:
    specs = {ship.name: ship for ship in BLUE_FLEET if ship.name in weights}
    total = sum(max(0.0, value) for value in weights.values())
    if total <= 0:
        return {}
    counts = {name: int(capacity * max(0.0, value) / total / specs[name].population) for name, value in weights.items()}
    used = sum(counts[name] * specs[name].population for name in counts)
    # Fill residual capacity with the best score-per-population choice.  This
    # keeps every proposal within the exact requested population budget.
    order = sorted(weights, key=lambda name: weights[name] / specs[name].population, reverse=True)
    while order:
        candidate = next((name for name in order if specs[name].population <= capacity - used), None)
        if candidate is None:
            break
        counts[candidate] += 1
        used += specs[candidate].population
    return {name: count for name, count in counts.items() if count}


def _own_ability_factor(composition: dict[str, int], own_level: int) -> tuple[float, tuple[str, ...]]:
    """Use only numeric ability rules; flag the rest without inventing formulas."""
    factor = 1.0
    efficiency = level_effectiveness(own_level)
    notes: list[str] = []
    for name, count in composition.items():
        ship = BLUE_BY_NAME[name]
        if ship.ability == "Сокрушение":
            chance = min(ship.ability_chance_cap, count * ship.ability_chance_rate) * efficiency
            factor += 1.25 * chance
            notes.append(f"{name}: «Сокрушение» до {chance:.0%} шанса")
        elif ship.ability == "Бонусные жизни":
            bonus = min(ship.ability_cap, count * ship.ability_rate) * efficiency
            factor += bonus * 0.10
            notes.append(f"{name}: «Бонусные жизни» +{bonus:.0%}")
        elif ship.ability == "Возрождение":
            bonus = min(ship.ability_cap, count * ship.ability_rate) * efficiency
            chance = min(ship.ability_chance_cap, count * ship.ability_chance_rate) * efficiency
            factor += bonus * chance * 0.20
            notes.append(f"{name}: «Возрождение» {chance:.0%} / до +{bonus:.0%}")
        elif ship.ability == "Улучшенная броня":
            bonus = min(ship.ability_cap, count * ship.ability_rate) * efficiency
            factor += bonus * 0.04
            notes.append(f"{name}: «Улучшенная броня» +{bonus:.0%}")
        elif ship.ability in {"Игнорирование брони", "Артиллерия"}:
            chance = min(ship.ability_chance_cap, count * ship.ability_chance_rate) * efficiency
            scope = "учтено против обороны" if ship.ability == "Артиллерия" else "зависит от брони цели"
            notes.append(f"{name}: «{ship.ability}» до {chance:.0%} ({scope})")
    return factor, tuple(notes)


def _composition_score(composition: dict[str, int], efficiencies: dict[str, float], coverage: dict[str, set[str]], own_level: int) -> tuple[float, tuple[str, ...]]:
    base = sum(count * efficiencies[name] for name, count in composition.items())
    # A small variety reward avoids misleading all-in fleets and rewards a
    # composition that covers more observed enemy ship classes.
    covered = set().union(*(coverage.get(name, set()) for name in composition)) if composition else set()
    ability_factor, ability_notes = _own_ability_factor(composition, own_level)
    return base * (1 + min(0.12, 0.025 * len(covered))) * ability_factor, ability_notes


def recommend_counter_fleets(
    scan: EnemyScan,
    *,
    capacity: int = 25_000,
    reserve: int = 1_600,
    full_combat_limit: bool = False,
    own_level: int = 10,
    top_n: int = 7,
) -> list[CounterPlan]:
    """Return diverse top counter-compositions, not a battle-win prediction."""
    if capacity <= 0 or reserve < 0:
        raise ValueError("Лимит населения и резерв не могут быть отрицательными")
    enemy_items = [
        (ALIASES[_normal(name)], count, scan.levels.get(name, 10))
        for name, count in scan.ships.items() if _normal(name) in ALIASES
    ]
    if not enemy_items:
        raise ValueError("Не распознаны корабли врага. Вставь строки вида «Немезис: 120».")
    budget = capacity if full_combat_limit else max(0, capacity - reserve)
    if budget <= 0:
        raise ValueError("Боевой бюджет населения равен нулю")
    capitals_seen = any(ship.capital for ship, _, _ in enemy_items)
    enemy_abilities = _enemy_ability_notes(enemy_items)
    available = [ship for ship in BLUE_FLEET if not ship.capital or capitals_seen]
    efficiencies: dict[str, float] = {}
    counter_text: dict[str, tuple[str, ...]] = {}
    warning_text: dict[str, tuple[str, ...]] = {}
    coverage: dict[str, set[str]] = {}
    for ship in available:
        value, counters, warnings = _ship_efficiency(ship, enemy_items, own_level)
        efficiencies[ship.name] = value
        counter_text[ship.name] = counters
        warning_text[ship.name] = warnings
        coverage[ship.name] = {enemy.name for enemy, _, _ in enemy_items if enemy.name in ship.bonus or enemy.name in ship.priority}
    ordered = sorted(available, key=lambda ship: efficiencies[ship.name], reverse=True)
    recipes: list[tuple[str, dict[str, float]]] = []
    base = {ship.name: efficiencies[ship.name] for ship in available}
    recipes.append(("Сбалансированный контр‑флот", base))
    for primary in ordered:
        weights = {name: score * 0.28 for name, score in base.items()}
        weights[primary.name] += efficiencies[primary.name] * 1.7
        # A second documented counter creates a usable combination rather than
        # presenting seven near-identical all-in suggestions.
        partner = next((ship for ship in ordered if ship.name != primary.name and coverage[ship.name] != coverage[primary.name]), None)
        if partner:
            weights[partner.name] += efficiencies[partner.name] * 0.55
        recipes.append((f"Акцент: {primary.name}", weights))
    unique: dict[tuple[tuple[str, int], ...], CounterPlan] = {}
    for title, weights in recipes:
        composition = _allocate(budget, weights)
        key = tuple(sorted(composition.items()))
        if not key:
            continue
        score, ability_notes = _composition_score(composition, efficiencies, coverage, own_level)
        counters = tuple(dict.fromkeys(item for name in composition for item in counter_text[name]))
        warnings = tuple(dict.fromkeys(item for name in composition for item in warning_text[name]))
        plan = CounterPlan(0, title, composition, sum(BLUE_BY_NAME[name].population * count for name, count in composition.items()), score, counters, warnings, ability_notes, enemy_abilities)
        if key not in unique or unique[key].score < score:
            unique[key] = plan
    ranked = sorted(unique.values(), key=lambda plan: plan.score, reverse=True)[:top_n]
    return [CounterPlan(index, plan.title, plan.ships, plan.population, plan.score, plan.counters[:3], plan.warnings[:2], plan.ability_notes[:3], plan.enemy_ability_notes[:3])
            for index, plan in enumerate(ranked, start=1)]


def recommend_planet_fleets(
    *,
    own_level: int = 10,
    civilian_reserve: int = 1_600,
    top_n: int = 7,
) -> list[CounterPlan]:
    """Recommend permanent blue-race fleets for own planets.

    This deliberately has no pasted reconnaissance input.  It balances the
    documented counter matrix against every regular red/green combat hull at
    level 10, keeps the requested civilian/command reserve, and leaves capital
    ships out of a normal planet fleet.
    """
    baseline = {ship.name: 100 for ship in ENEMY_FLEET if not ship.capital}
    plans = recommend_counter_fleets(
        EnemyScan(baseline, {name: 10 for name in baseline}, ()),
        capacity=25_000,
        reserve=civilian_reserve,
        full_combat_limit=False,
        own_level=own_level,
        top_n=top_n,
    )
    return [
        CounterPlan(
            plan.rank,
            "Постоянный флот · " + plan.title.removeprefix("Акцент: "),
            plan.ships,
            plan.population,
            plan.score,
            plan.counters,
            plan.warnings,
            plan.ability_notes,
            plan.enemy_ability_notes,
        )
        for plan in plans
    ]
