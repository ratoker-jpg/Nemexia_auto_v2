"""Verified base ship data from the supplied Nemexia information pages.

The catalog is deliberately static: the app must work without reaching the
user's account or the saved-pages folder at runtime.  Bonuses and penalties are
the explicit +70% / -30% lists shown by the game, not inferred game mechanics.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ShipSpec:
    name: str
    race: str
    population: int
    attack: int
    life: int
    priority: tuple[str, ...] = ()
    bonus: tuple[str, ...] = ()
    penalty: tuple[str, ...] = ()
    capital: bool = False
    aliases: tuple[str, ...] = ()
    ability: str = ""
    ability_rate: float = 0.0
    ability_cap: float = 0.0
    ability_chance_rate: float = 0.0
    ability_chance_cap: float = 0.0


TIER_1 = ("Скаут", "Истребитель", "Нокс Дарт")
TIER_CRUISER = ("Крейсер", "Перехватчик", "Немезис")
TIER_DEFENDER = ("Защитник", "Бот Щит", "Абсорбатор")
TIER_BATTLE = ("Боевой корабль", "Звездная Армада", "Призрак")
TIER_DESTROYER = ("Разрушитель", "Голиаф", "Шмель")
TIER_BOMBER = ("Бомбардировщик", "БомберБот")
CAPITALS = ("Звезда смерти", "Титан", "Нокс Царица")

# These ships are entered in the simulator through the same 1..13 grid as
# combat ships, but are deliberately not part of the counter-fleet heuristic:
# their saved information pages do not provide a combat profile used by it.
# Keeping their names here lets reconnaissance text be reproduced faithfully
# in the real simulator instead of silently turning them into zeroes.
SIMULATOR_SUPPORT_SHIPS = (
    "Транспортировщик", "Мегатранспортировщик", "Колонизатор", "Переработчик",
    "Шпионский зонд", "Солнечный спутник", "Товарный бот", "Большой товарный бот",
    "Бот колонизатор", "Шпионский бот", "Поселенец", "Трутень Переработчик",
    "Нокс разум", "Органический спутник",
)

# Commander ships have their own <select>/<input> controls, not ShipCount.
# The IDs are stable game IDs, confirmed against the live simulator form.
COMMANDER_SLOTS = {
    "Аннигилятор": 1, "Корсар": 2, "Реаниматор": 3, "Вайпер": 4,
    "Скорпион": 5, "Фантом": 6, "Охотник": 7, "Тайфун": 8,
    "Палач": 9, "Джаггернаут": 10, "Арго": 11, "Судья": 12,
    "Polias": 13,
}


BLUE_FLEET: tuple[ShipSpec, ...] = (
    ShipSpec("Скаут", "Синяя", 2, 800, 2400, TIER_DEFENDER, TIER_DEFENDER + TIER_BATTLE, TIER_1 + CAPITALS,
             aliases=("Scout",), ability="Игнорирование брони", ability_chance_rate=0.00035, ability_chance_cap=0.70),
    ShipSpec("Крейсер", "Синяя", 7, 3080, 9200, TIER_1, TIER_1 + TIER_DEFENDER, TIER_CRUISER + TIER_BATTLE,
             aliases=("Cruiser",), ability="Сокрушение", ability_chance_rate=0.0005, ability_chance_cap=0.50),
    ShipSpec("Защитник", "Синяя", 6, 2760, 8300, TIER_BOMBER, TIER_BOMBER + CAPITALS, TIER_1 + TIER_DEFENDER,
             aliases=("Defender",), ability="Бонусные жизни", ability_rate=0.0005, ability_cap=0.30),
    ShipSpec("Боевой корабль", "Синяя", 15, 9000, 27000, TIER_CRUISER, TIER_CRUISER + TIER_DEFENDER,
             TIER_BATTLE + TIER_DESTROYER, aliases=("Battle ship", "Battleship"), ability="Улучшенная броня", ability_rate=0.00038, ability_cap=0.30),
    ShipSpec("Разрушитель", "Синяя", 30, 19500, 58500, TIER_BATTLE, TIER_BATTLE + CAPITALS,
             TIER_DESTROYER + TIER_BOMBER, aliases=("Destroyer",), ability="Возрождение", ability_rate=0.0008, ability_cap=0.40,
             ability_chance_rate=0.0014, ability_chance_cap=0.70),
    ShipSpec("Бомбардировщик", "Синяя", 22, 13200, 39600, TIER_DESTROYER, TIER_DESTROYER + CAPITALS,
             TIER_CRUISER + TIER_BOMBER, aliases=("Bomber",), ability="Артиллерия", ability_chance_rate=0.001, ability_chance_cap=0.70),
    ShipSpec("Звезда смерти", "Синяя", 700, 700000, 2100000, CAPITALS, CAPITALS + TIER_CRUISER, TIER_DEFENDER,
             capital=True, aliases=("Death Star",), ability="Детонация", ability_chance_rate=0.03, ability_chance_cap=0.30),
)


ENEMY_FLEET: tuple[ShipSpec, ...] = (
    ShipSpec("Истребитель", "Зелёная", 2, 800, 2400, aliases=("Fighter",), ability="Игнорирование брони", ability_chance_rate=0.00035, ability_chance_cap=0.70),
    ShipSpec("Перехватчик", "Зелёная", 5, 2200, 6600, aliases=("Interceptor",), ability="Сокрушение", ability_chance_rate=0.00036, ability_chance_cap=0.50),
    ShipSpec("Бот Щит", "Зелёная", 7, 3220, 9700, aliases=("Shield Bot", "Bot Shield"), ability="Бонусные жизни", ability_rate=0.00075, ability_cap=0.30),
    ShipSpec("Звездная Армада", "Зелёная", 13, 7800, 23400, aliases=("Star Armada",), ability="Улучшенная броня", ability_rate=0.00028, ability_cap=0.30),
    ShipSpec("Голиаф", "Зелёная", 28, 18200, 54600, aliases=("Goliath",), ability="Мега сила", ability_rate=0.0009, ability_cap=0.80, ability_chance_rate=0.0008, ability_chance_cap=0.70),
    ShipSpec("БомберБот", "Зелёная", 20, 12000, 36000, aliases=("BomberBot", "Bomber Bot"), ability="Артиллерия", ability_chance_rate=0.0009, ability_chance_cap=0.70),
    ShipSpec("Титан", "Зелёная", 615, 615000, 1845000, capital=True, aliases=("Titan",), ability="Детонация", ability_chance_rate=0.025, ability_chance_cap=0.30),
    ShipSpec("Нокс Дарт", "Красная", 1, 400, 1200, aliases=("Nox Dart", "Nox"), ability="Игнорирование брони", ability_chance_rate=0.00035, ability_chance_cap=0.70),
    ShipSpec("Абсорбатор", "Красная", 3, 1380, 4100, aliases=("Absorber",), ability="Бонусные жизни", ability_rate=0.0003, ability_cap=0.30),
    ShipSpec("Немезис", "Красная", 2, 880, 2600, aliases=("Nemesis",), ability="Сокрушение", ability_chance_rate=0.00015, ability_chance_cap=0.50),
    ShipSpec("Призрак", "Красная", 10, 6000, 18000, aliases=("Phantom",), ability="Улучшенная броня", ability_rate=0.00018, ability_cap=0.30),
    ShipSpec("Шмель", "Красная", 17, 11050, 33200, aliases=("Bumblebee",), ability="Заморажение", ability_chance_rate=0.0004, ability_chance_cap=0.20),
    ShipSpec("Бомбардировщик", "Красная", 21, 12600, 37800, aliases=("Bomber",), ability="Артиллерия", ability_chance_rate=0.0009, ability_chance_cap=0.70),
    ShipSpec("Нокс Царица", "Красная", 320, 320000, 960000, capital=True, aliases=("Nox Queen",), ability="Детонация", ability_chance_rate=0.015, ability_chance_cap=0.30),
)


ALL_SHIPS = BLUE_FLEET + ENEMY_FLEET
BY_NAME = {ship.name: ship for ship in ALL_SHIPS}
BLUE_BY_NAME = {ship.name: ship for ship in BLUE_FLEET}
