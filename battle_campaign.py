"""Declarative verification packs for the real Nemexia battle simulator.

The game is the source of truth for combat formulas.  This module only builds
small, named experiments that make those formulas observable: one hull at a
time, quantity/level changes, commander leadership and defensive structures.
The runner records the exact pack and effective form values next to every
captured battle report, so a later analysis can be reproduced from files.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field, replace
from pathlib import Path
from typing import Any, Iterable

from battle_catalog import COMMANDER_SLOTS


RACE_LABELS = {1: "Конфедерация", 2: "Тертеты", 3: "Ноксы"}
CAMPAIGN_VERSION = 1
DEFAULT_ROUNDS = 12
DEFAULT_LEVEL = 10
COMMANDER_LEVEL = 40


@dataclass(frozen=True, slots=True)
class VerificationCase:
    """One complete submission to ``battleSimulator.php``."""

    case_id: str
    title: str
    attacker_ships: dict[str, int]
    attacker_levels: dict[str, int]
    defender_race_id: int
    defender_ships: dict[str, int]
    defender_levels: dict[str, int]
    attacker_commanders: dict[str, tuple[int, int]] = field(default_factory=dict)
    defender_commanders: dict[str, tuple[int, int]] = field(default_factory=dict)
    attacker_lead: str = ""
    defender_lead: str = ""
    defender_defence: dict[str, int] = field(default_factory=dict)
    rounds: int = DEFAULT_ROUNDS
    notes: str = ""

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["attacker_commanders"] = {
            name: [int(values[0]), int(values[1])] for name, values in self.attacker_commanders.items()
        }
        payload["defender_commanders"] = {
            name: [int(values[0]), int(values[1])] for name, values in self.defender_commanders.items()
        }
        return payload


def _catalog_items(catalog: dict[str, Any] | Iterable[tuple[str, Any]]) -> list[tuple[int, str, int]]:
    """Normalise the game's ``raceShips``/``raceDefence`` object."""
    items = catalog.items() if isinstance(catalog, dict) else catalog
    result: list[tuple[int, str, int]] = []
    for raw_slot, raw_item in items:
        try:
            slot = int(raw_slot)
        except (TypeError, ValueError):
            continue
        if isinstance(raw_item, dict):
            name = str(raw_item.get("name") or "").strip()
            population = int(raw_item.get("pop") or 0)
        else:
            name = str(getattr(raw_item, "name", "") or "").strip()
            population = int(getattr(raw_item, "population", 0) or 0)
        if name:
            result.append((slot, name, max(0, population)))
    return sorted(result)


def _ship_name(catalog: dict[str, Any] | Iterable[tuple[str, Any]], slot: int) -> str:
    return next((name for current, name, _ in _catalog_items(catalog) if current == slot), "")


def _base_case(
    *,
    case_id: str,
    title: str,
    attacker_ship: str,
    attacker_count: int,
    defender_race_id: int,
    defender_ship: str,
    defender_count: int = 20,
    attacker_level: int = DEFAULT_LEVEL,
    defender_level: int = DEFAULT_LEVEL,
    attacker_commanders: dict[str, tuple[int, int]] | None = None,
    defender_commanders: dict[str, tuple[int, int]] | None = None,
    attacker_lead: str = "",
    defender_lead: str = "",
    defender_defence: dict[str, int] | None = None,
    rounds: int = DEFAULT_ROUNDS,
    notes: str = "",
) -> VerificationCase:
    normalized_rounds = max(1, min(12, int(rounds)))
    return VerificationCase(
        case_id=case_id,
        title=title,
        attacker_ships={attacker_ship: max(0, int(attacker_count))},
        attacker_levels={attacker_ship: max(0, int(attacker_level))},
        defender_race_id=int(defender_race_id),
        defender_ships={defender_ship: max(0, int(defender_count))},
        defender_levels={defender_ship: max(0, int(defender_level))},
        attacker_commanders=dict(attacker_commanders or {}),
        defender_commanders=dict(defender_commanders or {}),
        attacker_lead=attacker_lead,
        defender_lead=defender_lead,
        defender_defence=dict(defender_defence or {}),
        rounds=normalized_rounds,
        notes=notes,
    )


def build_verification_campaign(
    attacker_race_id: int,
    race_ships: dict[int, dict[str, Any]],
    race_defence: dict[int, dict[str, Any]],
    *,
    rounds: int = DEFAULT_ROUNDS,
    commander_names: Iterable[str] | None = None,
) -> list[VerificationCase]:
    """Build the first evidence-gathering pack from live game slot names.

    The simulator has twelve non-capital ship slots: slots 1–8 and 10–13.
    We intentionally include the civilian/support slots as requested; the
    report will show whether they participate, consume a turn or are ignored.
    Slot 9 is the capital ship and is excluded from this discovery pack.
    """
    attacker_catalog = race_ships.get(int(attacker_race_id), {})
    attacker_items = [(slot, name, pop) for slot, name, pop in _catalog_items(attacker_catalog) if slot != 9]
    if not attacker_items:
        raise ValueError(f"В форме не найдены обычные корабли атакующей расы {attacker_race_id}")
    attacker_names = [name for _, name, _ in attacker_items]
    # The live form's stable slots put the six combat hulls at 3..8.  Fall back
    # to the first ordinary slot if a future game layout changes that order.
    combat_names = [name for slot, name, _ in attacker_items if 3 <= slot <= 8]
    attacker_probe = combat_names[0] if combat_names else attacker_names[0]

    defender_targets: dict[int, str] = {}
    for race_id in (1, 2, 3):
        target = _ship_name(race_ships.get(race_id, {}), 5)
        if target:
            defender_targets[race_id] = target
    if not defender_targets:
        raise ValueError("В форме не найдены корабли защитника для проверочного пакета")

    cases: list[VerificationCase] = []
    # Cross-race baselines make later ability comparisons meaningful.
    for race_id, target in defender_targets.items():
        cases.append(_base_case(
            case_id=f"baseline-race-{race_id}",
            title=f"База · {RACE_LABELS.get(race_id, f'раса {race_id}')}",
            attacker_ship=attacker_probe, attacker_count=20,
            defender_race_id=race_id, defender_ship=target, defender_count=20,
            attacker_level=DEFAULT_LEVEL, defender_level=DEFAULT_LEVEL,
            notes="Нулевая техника, без командиров и без обороны; межрасовый контрольный бой.",
        ))

    # Every ordinary slot, including civilian/support ships.
    primary_target = defender_targets.get(1) or next(iter(defender_targets.values()))
    priority_targets = [
        name for slot, name, _ in _catalog_items(race_ships.get(1, {})) if 3 <= slot <= 8
    ]
    if not priority_targets:
        priority_targets = [primary_target]
    priority_fleet = {name: 1 for name in priority_targets}
    priority_levels = {name: DEFAULT_LEVEL for name in priority_targets}
    for slot, name, _ in attacker_items:
        cases.append(_base_case(
            case_id=f"hull-{slot}", title=f"Корпус · {name} · 1 шт.",
            attacker_ship=name, attacker_count=1, defender_race_id=1,
            defender_ship=primary_target, defender_count=1, attacker_level=DEFAULT_LEVEL,
            notes="Одиночный корпус; фиксируем фактический первый раунд и итог игры.",
        ))
        for count in (3, 10, 33):
            cases.append(_base_case(
                case_id=f"quantity-{slot}-{count}", title=f"Количество · {name} · {count} шт.",
                attacker_ship=name, attacker_count=count, defender_race_id=1,
                defender_ship=primary_target, defender_count=20, attacker_level=DEFAULT_LEVEL,
                notes="Изолированная проверка зависимости способности и урона от количества.",
            ))
        for level in (0, 5, 10):
            cases.append(_base_case(
                case_id=f"level-{slot}-{level}", title=f"Уровень · {name} · ур. {level}",
                attacker_ship=name, attacker_count=1, defender_race_id=1,
                defender_ship=primary_target, defender_count=20, attacker_level=level,
                notes="Уровень обычного корабля; технологии остаются нулевыми.",
            ))
        cases.append(VerificationCase(
            case_id=f"priority-{slot}", title=f"Приоритет · {name} против смешанной цели",
            attacker_ships={name: 1}, attacker_levels={name: DEFAULT_LEVEL},
            defender_race_id=1, defender_ships=dict(priority_fleet),
            defender_levels=dict(priority_levels),
            notes="Смешанная группа целей; фиксируем, какой канонический приоритет выбирает корабль.",
        ))

    # One commander at a time.  The selected commander is also the leader, so
    # its ability is guaranteed to be the active one for this isolated test.
    # If the account does not own every commander, the live form leaves some
    # commander slots unnamed; do not manufacture impossible submissions.
    available_commanders = list(COMMANDER_SLOTS)
    if commander_names is not None:
        requested = {str(name).strip().casefold() for name in commander_names if str(name).strip()}
        available_commanders = [
            name for name in COMMANDER_SLOTS if name.casefold() in requested
        ]
    for commander in available_commanders:
        cases.append(_base_case(
            case_id=f"commander-{commander}", title=f"Командир · {commander} · ур. {COMMANDER_LEVEL}",
            attacker_ship=attacker_probe, attacker_count=20, defender_race_id=1,
            defender_ship=primary_target, defender_count=20, attacker_level=DEFAULT_LEVEL,
            attacker_commanders={commander: (1, COMMANDER_LEVEL)}, attacker_lead=commander,
            notes="Один командир включён и выбран ведущим; остальные командиры отсутствуют.",
        ))

    # Repeat the isolated commander sweep on the defender side.  A named
    # commander may expose a different effect when it leads the defence.
    for commander in available_commanders:
        cases.append(_base_case(
            case_id=f"defender-commander-{commander}",
            title=f"Командир защитника · {commander} · ур. {COMMANDER_LEVEL}",
            attacker_ship=attacker_probe, attacker_count=20, defender_race_id=1,
            defender_ship=primary_target, defender_count=20, attacker_level=DEFAULT_LEVEL,
            defender_commanders={commander: (1, COMMANDER_LEVEL)}, defender_lead=commander,
            notes="Один командир защитника включён и выбран ведущим; остальные командиры отсутствуют.",
        ))

    # Explicitly demonstrate that only the selected leader should matter when
    # two commanders are present.  Use the first two stable commander slots.
    if len(available_commanders) >= 2:
        left, right = available_commanders[:2]
        for lead in (left, right):
            cases.append(_base_case(
                case_id=f"leader-{lead}", title=f"Ведущий · {left}+{right} → {lead}",
                attacker_ship=attacker_probe, attacker_count=20, defender_race_id=1,
                defender_ship=primary_target, defender_count=20, attacker_level=DEFAULT_LEVEL,
                attacker_commanders={left: (1, COMMANDER_LEVEL), right: (1, COMMANDER_LEVEL)},
                attacker_lead=lead,
                notes="Оба командира присутствуют; меняется только выбранный ведущий.",
            ))
            cases.append(_base_case(
                case_id=f"defender-leader-{lead}",
                title=f"Ведущий защитника · {left}+{right} → {lead}",
                attacker_ship=attacker_probe, attacker_count=20, defender_race_id=1,
                defender_ship=primary_target, defender_count=20, attacker_level=DEFAULT_LEVEL,
                defender_commanders={left: (1, COMMANDER_LEVEL), right: (1, COMMANDER_LEVEL)},
                defender_lead=lead,
                notes="Оба командира защитника присутствуют; меняется только выбранный ведущий.",
            ))

    # Every defensive structure for every race, including both shield
    # variants.  The game enforces the one-unit shield limit itself.
    for race_id, target in defender_targets.items():
        for slot, name, _ in _catalog_items(race_defence.get(race_id, {})):
            cases.append(_base_case(
                case_id=f"defence-{race_id}-{slot}",
                title=f"Оборона · {RACE_LABELS.get(race_id, race_id)} · {name} · 1 шт.",
                attacker_ship=attacker_probe, attacker_count=20, defender_race_id=race_id,
                defender_ship=target, defender_count=20, attacker_level=DEFAULT_LEVEL,
                defender_defence={name: 1},
                notes="Одна оборонительная единица; технологии и бонусы адмирала равны нулю.",
            ))

    normalized_rounds = max(1, min(12, int(rounds)))
    if normalized_rounds != DEFAULT_ROUNDS:
        cases = [replace(case, rounds=normalized_rounds) for case in cases]
    return cases


def campaign_manifest(
    *,
    run_id: str,
    attacker_race_id: int,
    cases: Iterable[VerificationCase],
    rounds: int = DEFAULT_ROUNDS,
    clean_technologies: bool = True,
) -> dict[str, Any]:
    """Return a JSON-safe manifest written before the first battle starts."""
    case_list = list(cases)
    return {
        "version": CAMPAIGN_VERSION,
        "run_id": run_id,
        "attacker_race_id": int(attacker_race_id),
        "attacker_race": RACE_LABELS.get(int(attacker_race_id), f"раса {attacker_race_id}"),
        "rounds": max(1, min(12, int(rounds))),
        "clean_technologies": bool(clean_technologies),
        "retention": "append-only",
        "case_count": len(case_list),
        "cases": [case.to_dict() for case in case_list],
    }


def write_campaign_manifest(path: Path, payload: dict[str, Any]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    import json
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)
    return path
