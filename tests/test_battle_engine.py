from battle_engine import level_effectiveness, parse_enemy_scan, recommend_counter_fleets, recommend_planet_fleets
from battle_feature import _normalise_scenario_commanders, _scan_race_id
from battle_simulator import SimulatorScenario


def test_parser_accepts_russian_and_latin_ship_names():
    scan = parse_enemy_scan("Немезис: 120\n20 Голиаф\nNox Dart x 300")

    assert scan.ships == {"Нокс Дарт": 300, "Немезис": 120, "Голиаф": 20}


def test_parser_accepts_report_levels_and_level_ten_is_full_effectiveness():
    scan = parse_enemy_scan(
        "Корабли\nЗащитник : 400 на уровне 10\nБоевой корабль : 373 на уровне 9\nРазрушитель : 467 на уровне 8"
    )

    assert scan.ships == {"Защитник": 400, "Боевой корабль": 373, "Разрушитель": 467}
    assert scan.levels == {"Защитник": 10, "Боевой корабль": 9, "Разрушитель": 8}
    assert level_effectiveness(10) == 1.0
    assert level_effectiveness(9) == 0.95


def test_parser_keeps_simulator_only_ships_and_commander_ships():
    scan = parse_enemy_scan(
        "Солнечный спутник : 30 на уровне 10\nОхотник : 1 на уровне 32\nПалач : 1 на уровне 37"
    )

    assert scan.ships == {"Солнечный спутник": 30}
    assert scan.commanders == {"Охотник": (1, 32), "Палач": (1, 37)}


def test_selected_confederation_resolves_shared_bomber_name_as_blue_race():
    scan = parse_enemy_scan(
        "Защитник : 600 на уровне 10\nРазрушитель : 372 на уровне 10\nБомбардировщик : 218 на уровне 10",
        "Конфедерация",
    )

    assert scan.ships["Бомбардировщик"] == 218
    assert _scan_race_id(scan, 1) == 1
    assert _scan_race_id(scan) == 1


def test_parser_keeps_hunter_and_juggernaut_with_exact_levels():
    scan = parse_enemy_scan("Охотник : 1 на уровне 10\nДжаггернаут : 1 на уровне 15", "Конфедерация")

    assert scan.commanders == {"Охотник": (1, 10), "Джаггернаут": (1, 15)}


def test_top_seven_stay_within_regular_fleet_budget():
    scan = parse_enemy_scan("Немезис: 120\nГолиаф: 20\nНокс Дарт: 300")

    plans = recommend_counter_fleets(scan, capacity=25_000, reserve=1_600)

    assert len(plans) == 7
    assert all(plan.population <= 23_400 for plan in plans)
    assert all("Звезда смерти" not in plan.ships for plan in plans)
    assert any("+70% против Нокс Дарт" in item for item in plans[0].counters)


def test_capital_is_only_considered_when_enemy_capital_is_seen():
    scan = parse_enemy_scan("Титан: 1\nГолиаф: 20")

    plans = recommend_counter_fleets(scan, full_combat_limit=True)

    assert any("Звезда смерти" in plan.ships for plan in plans)


def test_special_abilities_are_attached_to_recommendations():
    scan = parse_enemy_scan("Немезис: 500")

    plans = recommend_counter_fleets(scan)

    assert any(plan.ability_notes for plan in plans)
    assert any("Сокрушение" in note for plan in plans for note in plan.ability_notes)


def test_planet_top_seven_are_universal_and_keep_civilian_reserve():
    plans = recommend_planet_fleets(own_level=10)

    assert len(plans) == 7
    assert all(plan.population <= 23_400 for plan in plans)
    assert all(plan.title.startswith("Постоянный флот") for plan in plans)
    assert all("Звезда смерти" not in plan.ships for plan in plans)
    assert len({tuple(sorted(plan.ships.items())) for plan in plans}) == 7
    assert len({max(plan.ships, key=plan.ships.get) for plan in plans}) >= 5


def test_planet_fleets_respect_custom_civilian_population():
    plans = recommend_planet_fleets(own_level=10, civilian_reserve=2_000)

    assert len(plans) == 7
    assert all(plan.population <= 23_000 for plan in plans)


def test_wave_residual_commanders_are_never_sent_as_regular_ships():
    scenario = SimulatorScenario(
        "wave", 1,
        {"\u041e\u0445\u043e\u0442\u043d\u0438\u043a": 1, "\u0414\u0436\u0430\u0433\u0433\u0435\u0440\u043d\u0430\u0443\u0442": 1, "\u0420\u0430\u0437\u0440\u0443\u0448\u0438\u0442\u0435\u043b\u044c": 3},
        {"\u041e\u0445\u043e\u0442\u043d\u0438\u043a": 10, "\u0414\u0436\u0430\u0433\u0433\u0435\u0440\u043d\u0430\u0443\u0442": 15},
    )

    normalised = _normalise_scenario_commanders(scenario)

    assert normalised.ships == {"\u0420\u0430\u0437\u0440\u0443\u0448\u0438\u0442\u0435\u043b\u044c": 3}
    assert normalised.commanders == {"\u041e\u0445\u043e\u0442\u043d\u0438\u043a": (1, 10), "\u0414\u0436\u0430\u0433\u0433\u0435\u0440\u043d\u0430\u0443\u0442": (1, 15)}
