from fleet_planner_feature import COMMAND_COORD, build_transfer_plan, is_excluded_planet
from fleet_manager_feature import calculate_dislocation_plan, calculate_fleet_readiness
from pathlib import Path


def _planet(name, coord, resources, *, time_seconds=60, free_population=10_000):
    return {
        "name": name,
        "coord": coord,
        "resources": resources,
        "hangar": {"total": free_population, "used": 0, "free": free_population},
        "ships": {
            "Разрушитель": {
                "cost": {"metal": 100, "minerals": 80, "gas": 10},
                "population": 30,
                "time_seconds": time_seconds,
            }
        },
    }


def test_command_planet_is_excluded_by_coord_and_name():
    assert is_excluded_planet({"name": "что угодно", "coord": COMMAND_COORD})
    assert is_excluded_planet({"name": "Clickm Error 256", "coord": "3:39:99"})


def test_equal_plan_includes_moscow_and_uses_its_stock_for_local_building():
    snapshot = {
        "planets": [
            _planet("Москва", "3:39:11", {"metal": 1000, "minerals": 1000, "gas": 1000}),
            _planet("Питер", "3:39:8", {"metal": 100, "minerals": 0, "gas": 10}),
            _planet("Русь", "3:39:13", {"metal": 0, "minerals": 500, "gas": 0}),
            _planet("Clickm Error 256", COMMAND_COORD, {"metal": 999999, "minerals": 999999, "gas": 999999}),
        ]
    }

    plan = build_transfer_plan(snapshot, "Разрушитель", 10)

    assert [row["quantity"] for row in plan["rows"]] == [4, 3, 3]
    assert plan["rows"][0]["name"] == "Москва"
    assert plan["rows"][0]["is_moscow"] is True
    assert plan["moscow_build_need"] == {"metal": 400, "minerals": 320, "gas": 40}
    assert plan["required"] == {"metal": 500, "minerals": 240, "gas": 50}
    assert plan["sufficient"] is True
    assert [transfer["coord"] for transfer in plan["transfers"]] == ["3:39:8", "3:39:13"]
    assert all(transfer["ship_count"] == 1 for transfer in plan["transfers"])


def test_fastest_plan_biases_to_shorter_live_build_time_including_moscow():
    snapshot = {
        "planets": [
            _planet("Москва", "3:39:11", {"metal": 100000, "minerals": 100000, "gas": 100000}, time_seconds=30),
            _planet("Питер", "3:39:8", {"metal": 0, "minerals": 0, "gas": 0}, time_seconds=60),
            _planet("Русь", "3:39:13", {"metal": 0, "minerals": 0, "gas": 0}, time_seconds=90),
        ]
    }

    plan = build_transfer_plan(snapshot, "Разрушитель", 12, mode="fastest")

    assert [row["quantity"] for row in plan["rows"]] == [7, 3, 2]
    assert plan["rows"][0]["quantity"] > plan["rows"][1]["quantity"] > plan["rows"][2]["quantity"]


def test_plan_fails_when_a_planet_lacks_free_population():
    snapshot = {
        "planets": [
            _planet("Москва", "3:39:11", {"metal": 100000, "minerals": 100000, "gas": 100000}),
            _planet("Питер", "3:39:8", {"metal": 0, "minerals": 0, "gas": 0}, free_population=20),
        ]
    }

    plan = build_transfer_plan(snapshot, "Разрушитель", 4)

    peter = next(row for row in plan["rows"] if row["name"] == "Питер")
    assert peter["population_need"] == 60
    assert peter["population_remainder"] == -40
    assert plan["population_sufficient"] is False
    assert plan["sufficient"] is False


def test_manual_exclusion_removes_any_planet_from_building_and_dislocation():
    snapshot = {
        "planets": [
            _planet("Москва", "3:39:11", {"metal": 100000, "minerals": 100000, "gas": 100000}),
            _planet("Краснодар", "2:15:16", {"metal": 100000, "minerals": 100000, "gas": 100000}),
            _planet("Питер", "3:39:8", {"metal": 100000, "minerals": 100000, "gas": 100000}),
        ]
    }
    for planet in snapshot["planets"]:
        planet["fleet"] = {"Разрушитель": 0}
        planet["factory_queue"] = []
    excluded = {"2:15:16"}

    build = build_transfer_plan(snapshot, "Разрушитель", 9, excluded_coords=excluded)
    assert [row["coord"] for row in build["rows"]] == ["3:39:11", "3:39:8"]

    readiness = calculate_fleet_readiness(
        snapshot, {"2:15:16": {"Разрушитель": 100}, "3:39:8": {"Разрушитель": 5}}, {}, excluded,
    )
    assert "2:15:16" not in readiness["targets"]
    dislocation = calculate_dislocation_plan(snapshot, readiness["targets"], {}, excluded)
    assert not dislocation["moves"]


def test_scanner_uses_only_serial_shipyard_tab_and_dark_combo_popup():
    source = (Path(__file__).resolve().parents[1] / "fleet_planner_feature.py").read_text(encoding="utf-8")

    assert "document.querySelectorAll('#TabShips .structureItem')" in source
    assert 'form[id^="shipsTrainForm-"]' in source
    assert '*TCombobox*Listbox.background' in source
    assert '*TCombobox*Listbox.foreground' in source
    assert 'value="По скорости строительства"' in source
    assert '"Ангар / население"' in source
    assert 'ship_id: id' in source
    assert 'type=trainAll' in source
    assert 'Строительство не начато' in source
    assert 'Запустить строительство' in source


def test_disabled_ship_card_uses_visible_duration_when_game_omits_hidden_time_input():
    source = (Path(__file__).resolve().parents[1] / "fleet_planner_feature.py").read_text(encoding="utf-8")
    assert "const durationSeconds" in source
    assert "item?.querySelector('.shipTime')?.textContent" in source
    assert "time_seconds: Number(hiddenTime) > 0 ? hiddenTime : visibleTime" in source
