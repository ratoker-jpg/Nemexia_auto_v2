from __future__ import annotations

import unittest

from battle_engine import EnemyScan
from battle_simulator import (
    SimulatorResult, build_planet_candidates, build_planet_scenarios, build_simulator_candidates, parse_report_summary, rank_simulator_results,
)


class BattleSimulatorHelpersTest(unittest.TestCase):
    def test_candidates_are_distinct_and_fit_population_cap(self) -> None:
        scan = EnemyScan({"\u041d\u0435\u043c\u0435\u0437\u0438\u0441": 120}, {"\u041d\u0435\u043c\u0435\u0437\u0438\u0441": 10}, ())
        candidates = build_simulator_candidates(scan)
        self.assertGreaterEqual(len(candidates), 12)
        self.assertTrue(all(plan.population <= 25_000 for plan in candidates))
        self.assertEqual(len(candidates), len({tuple(sorted(plan.ships.items())) for plan in candidates}))

    def test_support_only_scan_still_gets_real_simulator_candidates(self) -> None:
        scan = EnemyScan({"Солнечный спутник": 30}, {"Солнечный спутник": 10}, ())
        candidates = build_simulator_candidates(scan)
        self.assertGreaterEqual(len(candidates), 12)
        self.assertTrue(all(plan.population <= 25_000 for plan in candidates))

    def test_real_wins_rank_before_losses(self) -> None:
        fleet = {"\u0421\u043a\u0430\u0443\u0442": 1}
        lost = SimulatorResult("loss", fleet, 2, "\u0417\u0430\u0449\u0438\u0442\u043d\u0438\u043a \u043f\u043e\u0431\u0435\u0434\u0438\u0442\u0435\u043b\u044c", 0, 10, 3, "")
        won = SimulatorResult("win", fleet, 2, "\u0410\u0442\u0430\u043a\u0443\u044e\u0449\u0438\u0439 \u043f\u043e\u0431\u0435\u0434\u0438\u0442\u0435\u043b\u044c", 1, 0, 2, "")
        self.assertEqual(rank_simulator_results([lost, won])[0].title, "win")

    def test_report_uses_remaining_not_initial_defender_population(self) -> None:
        text = (
            "\u0417\u0430\u0449\u0438\u0442\u043d\u0438\u043a \u041a\u043e\u0440\u0430\u0431\u043b\u0438: 30 "
            "\u0410\u0442\u0430\u043a\u0443\u044e\u0449\u0438\u0439 \u043f\u043e\u0431\u0435\u0434\u0438\u0442\u0435\u043b\u044c "
            "\u041e\u0441\u0442\u0430\u0432\u0448\u0430\u044f\u0441\u044f \u043f\u043e\u043f\u0443\u043b\u044f\u0446\u0438\u044f: \u0410\u0442\u0430\u043a\u0443\u044e\u0449\u0438\u0435 \u041a\u043e\u0440\u0430\u0431\u043b\u0438: 23666 "
            "\u041e\u0441\u0442\u0430\u0432\u0448\u0430\u044f\u0441\u044f \u043f\u043e\u043f\u0443\u043b\u044f\u0446\u0438\u044f: \u0417\u0430\u0449\u0438\u0442\u043d\u0438\u043a\u0438 \u041a\u043e\u0440\u0430\u0431\u043b\u0438: 0 \u0420\u0430\u0443\u043d\u0434 1"
        )
        _, attacker, defender, _ = parse_report_summary(text)
        self.assertEqual(attacker, 23_666)
        self.assertEqual(defender, 0)

    def test_permanent_matrix_uses_twelve_non_capital_opponents(self) -> None:
        candidates = build_planet_candidates(23_400)
        scenarios = build_planet_scenarios(23_400)
        self.assertEqual(len(candidates), 12)
        self.assertEqual(len(scenarios), 12)
        self.assertTrue(all(candidate.population <= 23_400 for candidate in candidates))
        self.assertTrue(all("\u0417\u0432\u0435\u0437\u0434\u0430" not in name for scenario in scenarios for name in scenario.ships))
        self.assertTrue(all("\u0422\u0438\u0442\u0430\u043d" not in name for scenario in scenarios for name in scenario.ships))
        self.assertTrue(all("\u0426\u0430\u0440\u0438\u0446" not in name for scenario in scenarios for name in scenario.ships))


if __name__ == "__main__":
    unittest.main()
