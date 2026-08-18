from __future__ import annotations

import asyncio
import unittest

from bound_tab_fix import _active_game_target_id, _choose_active_game_page


class FakePage:
    def __init__(self, url: str, *, focused: bool = False, visible: bool = False, closed: bool = False) -> None:
        self.url = url
        self.focused = focused
        self.visible = visible
        self.closed = closed

    def is_closed(self) -> bool:
        return self.closed

    async def evaluate(self, _script: str):
        return {"focused": self.focused, "visible": self.visible}


class FakeContext:
    def __init__(self, pages):
        self.pages = pages


class FakeBrowser:
    def __init__(self, pages):
        self.contexts = [FakeContext(pages)]


class FakeWorker:
    def __init__(self, pages):
        self._browser = FakeBrowser(pages)


class BoundTabFixTest(unittest.TestCase):
    def test_devtools_order_selects_first_game_tab(self) -> None:
        targets = [
            {"id": "active-game", "type": "page", "url": "https://game.ares.nemexia.com/fleets.php"},
            {"id": "other-game", "type": "page", "url": "https://game.ares.nemexia.com/ranking.php"},
            {"id": "new-tab", "type": "page", "url": "chrome://newtab/"},
        ]
        self.assertEqual(_active_game_target_id(targets), "active-game")

    def test_devtools_skips_non_game_tab_before_active_game(self) -> None:
        targets = [
            {"id": "new-tab", "type": "page", "url": "chrome://newtab/"},
            {"id": "active-game", "type": "page", "url": "https://game.ares.nemexia.com/fleets.php"},
        ]
        self.assertEqual(_active_game_target_id(targets), "active-game")

    def test_focused_game_page_wins(self) -> None:
        first = FakePage("https://game.ares.nemexia.com/fleets.php", visible=True)
        second = FakePage("https://game.ares.nemexia.com/galaxy.php", focused=True, visible=True)
        selected = asyncio.run(_choose_active_game_page(FakeWorker([first, second])))
        self.assertIs(selected, second)

    def test_single_visible_game_page_is_selected(self) -> None:
        first = FakePage("https://game.ares.nemexia.com/fleets.php", visible=False)
        second = FakePage("https://game.ares.nemexia.com/galaxy.php", visible=True)
        selected = asyncio.run(_choose_active_game_page(FakeWorker([first, second])))
        self.assertIs(selected, second)

    def test_ambiguous_multiple_tabs_stop(self) -> None:
        pages = [
            FakePage("https://game.ares.nemexia.com/fleets.php", visible=True),
            FakePage("https://game.ares.nemexia.com/galaxy.php", visible=True),
        ]
        with self.assertRaisesRegex(Exception, "несколько активных вкладок"):
            asyncio.run(_choose_active_game_page(FakeWorker(pages)))

    def test_closed_tab_is_never_selected(self) -> None:
        closed = FakePage("https://game.ares.nemexia.com/fleets.php", focused=True, visible=True, closed=True)
        active = FakePage("https://game.ares.nemexia.com/galaxy.php", visible=True)
        selected = asyncio.run(_choose_active_game_page(FakeWorker([closed, active])))
        self.assertIs(selected, active)


if __name__ == "__main__":
    unittest.main()
