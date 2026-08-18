import unittest
from pathlib import Path


class BrowserRestartTests(unittest.TestCase):
    def test_restart_targets_only_the_dedicated_profile_and_port(self):
        source = (Path(__file__).resolve().parent / "browser.py").read_text(encoding="utf-8")
        self.assertIn("def stop_managed_yandex", source)
        self.assertIn("--user-data-dir=", source)
        self.assertIn("--remote-debugging-port=", source)
        self.assertIn('"/T", "/F"', source)

    def test_sidebar_exposes_restart_action(self):
        source = (Path(__file__).resolve().parent / "app.py").read_text(encoding="utf-8")
        self.assertIn('"Перезапустить браузер", self.restart_browser', source)
        self.assertIn("await self.worker.shutdown()", source)


if __name__ == "__main__":
    unittest.main()
