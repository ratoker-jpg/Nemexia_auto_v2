from __future__ import annotations

import unittest

from battle_campaign import build_verification_campaign, campaign_manifest


def _ship(name: str, pop: int) -> dict[str, str]:
    return {"name": name, "pop": str(pop)}


class VerificationCampaignTest(unittest.TestCase):
    def setUp(self) -> None:
        self.ships = {
            1: {"5": _ship("Защитник", 6)},
            2: {
                "1": _ship("Товарный бот", 1), "2": _ship("Большой товарный бот", 7),
                "3": _ship("Истребитель", 2), "4": _ship("Перехватчик", 5),
                "5": _ship("Бот Щит", 7), "6": _ship("Звездная Армада", 13),
                "7": _ship("Голиаф", 28), "8": _ship("БомберБот", 20),
                "9": _ship("Титан", 615), "10": _ship("Бот колонизатор", 12),
                "11": _ship("Переработчик", 7), "12": _ship("Шпионский бот", 1),
                "13": _ship("Солнечный спутник", 1),
            },
            3: {"5": _ship("Абсорбатор", 3)},
        }
        self.defence = {1: {"1": _ship("Баллистическая установка", 2), "7": _ship("Планетарный щит", 44)}}

    def test_pack_contains_all_twelve_non_capital_slots(self) -> None:
        cases = build_verification_campaign(2, self.ships, self.defence)
        hull_cases = {case.attacker_ships and next(iter(case.attacker_ships)) for case in cases if case.case_id.startswith("hull-")}
        self.assertEqual(hull_cases, {
            "Товарный бот", "Большой товарный бот", "Истребитель", "Перехватчик", "Бот Щит",
            "Звездная Армада", "Голиаф", "БомберБот", "Бот колонизатор", "Переработчик",
            "Шпионский бот", "Солнечный спутник",
        })
        self.assertTrue(any(case.case_id == "commander-Судья" for case in cases))
        self.assertTrue(any(case.case_id == "defender-commander-Судья" for case in cases))
        priority = next(case for case in cases if case.case_id == "priority-3")
        self.assertGreaterEqual(len(priority.defender_ships), 1)
        self.assertTrue(any(case.case_id == "defence-1-7" for case in cases))

    def test_manifest_is_append_only_and_describes_cases(self) -> None:
        cases = build_verification_campaign(2, self.ships, self.defence, rounds=8)
        manifest = campaign_manifest(run_id="abc123", attacker_race_id=2, cases=cases, rounds=8)
        self.assertEqual(manifest["retention"], "append-only")
        self.assertEqual(manifest["rounds"], 8)
        self.assertTrue(all(case.rounds == 8 for case in cases))
        self.assertEqual(manifest["case_count"], len(cases))
        self.assertEqual(manifest["attacker_race_id"], 2)

    def test_unavailable_commanders_are_not_scheduled(self) -> None:
        cases = build_verification_campaign(2, self.ships, self.defence, commander_names=["Судья"])
        self.assertTrue(any(case.case_id == "commander-Судья" for case in cases))
        self.assertFalse(any(case.case_id == "commander-Корсар" for case in cases))
        self.assertFalse(any(case.case_id.startswith("leader-") for case in cases))


if __name__ == "__main__":
    unittest.main()
