import unittest
from pathlib import Path

from fleet_manager_feature import calculate_dislocation_plan, calculate_fleet_readiness


def planet(name, coord, ships, *, free=1_000, total=25_000):
    return {
        "name": name, "coord": coord,
        "hangar": {"total": total, "used": total - free, "free": free},
        "ships": {"Крейсер": {"ship_id": "7", "population": 10}},
        "fleet": {"Крейсер": ships},
    }


class FleetManagerPlanTests(unittest.TestCase):
    def test_scanner_uses_shipyard_count_and_factory_queue(self):
        source = (Path(__file__).resolve().parent / "fleet_planner_feature.py").read_text(encoding="utf-8")
        self.assertIn("#ShipsAvaible-", source)
        self.assertIn("[id^=\"ShipsAvaible-\"]", source)
        self.assertIn("#structuresQueue .queueItem", source)

    def test_plan_uses_only_surplus_and_skips_locked_source(self):
        snapshot = {"planets": [
            planet("Москва", "3:39:11", 700),
            planet("Питер", "3:39:8", 200, free=10_000),
            planet("Ростов", "3:39:9", 500),
        ]}
        targets = {"3:39:8": {"Крейсер": 1_000}, "3:39:9": {"Крейсер": 400}}

        plan = calculate_dislocation_plan(snapshot, targets, {"3:39:11": True})

        self.assertEqual(len(plan["moves"]), 1)
        self.assertEqual(plan["moves"][0]["source_coord"], "3:39:9")
        self.assertEqual(plan["moves"][0]["amount"], 100)
        self.assertEqual(plan["unresolved"][0]["amount"], 700)

    def test_plan_respects_target_hangar_space(self):
        snapshot = {"planets": [
            planet("Москва", "3:39:11", 700),
            planet("Питер", "3:39:8", 200, free=1_500),
        ]}
        plan = calculate_dislocation_plan(snapshot, {"3:39:8": {"Крейсер": 500}}, {})

        self.assertEqual(plan["moves"][0]["amount"], 150)
        self.assertEqual(plan["unresolved"][0]["amount"], 150)
        self.assertEqual(plan["unresolved"][0]["reason"], "недостаточно свободного ангара")

    def test_filler_uses_remaining_capacity_and_queue_prevents_duplicate_build(self):
        snapshot = {"planets": [{
            "name": "Питер", "coord": "3:39:8", "hangar": {"total": 100, "used": 0, "free": 100},
            "ships": {"МТ": {"population": 10}, "Переработчик": {"population": 10}},
            "fleet": {"МТ": 2, "Переработчик": 5},
            "factory_queue": [{"name": "Переработчик", "amount": 1}],
        }]}
        readiness = calculate_fleet_readiness(snapshot, {"3:39:8": {"МТ": 2}}, {"3:39:8": "Переработчик"})

        self.assertEqual(readiness["targets"]["3:39:8"]["Переработчик"], 8)
        self.assertEqual(readiness["requirements"]["3:39:8"]["Переработчик"], 2)


if __name__ == "__main__":
    unittest.main()
