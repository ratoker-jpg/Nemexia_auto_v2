from __future__ import annotations

import asyncio
import json
from typing import Any
from urllib.request import urlopen

from browser import BrowserAutomationError, BrowserWorker
from config import GAME_HOST


_ORIGINAL_CONNECT = BrowserWorker.connect
_INSTALLED = False


def _all_open_pages(worker: BrowserWorker) -> list[Any]:
    browser = getattr(worker, "_browser", None)
    if browser is None:
        return []
    return [
        page
        for context in browser.contexts
        for page in context.pages
        if not page.is_closed()
    ]


def _active_game_target_id(payload: list[dict[str, Any]]) -> str | None:
    """Return the first active Nemexia page reported by Chromium.

    Chromium's ``/json/list`` is ordered by selected tab.  Unlike
    ``document.hasFocus()`` and ``visibilityState`` under remote debugging,
    this order remains correct when more than one game tab is open.
    """
    for target in payload:
        if target.get("type") == "page" and GAME_HOST in str(target.get("url", "")):
            target_id = str(target.get("id") or "").strip()
            if target_id:
                return target_id
    return None


async def _page_target_id(page: Any) -> str | None:
    session = None
    try:
        session = await page.context.new_cdp_session(page)
        details = await session.send("Target.getTargetInfo")
        return str(details.get("targetInfo", {}).get("targetId") or "") or None
    except Exception:
        return None
    finally:
        if session is not None:
            try:
                await session.detach()
            except Exception:
                pass


def _devtools_targets(endpoint: str) -> list[dict[str, Any]]:
    with urlopen(f"{endpoint.rstrip('/')}/json/list", timeout=2.0) as response:
        payload = json.load(response)
    return payload if isinstance(payload, list) else []


async def _choose_active_game_page(worker: BrowserWorker) -> Any:
    game_pages = [page for page in _all_open_pages(worker) if GAME_HOST in str(page.url)]
    if not game_pages:
        raise BrowserAutomationError("Открытая вкладка Nemexia не найдена")

    endpoint = str(getattr(worker, "_endpoint", "") or "").strip()
    if endpoint:
        try:
            active_target = _active_game_target_id(await asyncio.to_thread(_devtools_targets, endpoint))
            if active_target:
                for page in game_pages:
                    if await _page_target_id(page) == active_target:
                        return page
        except Exception:
            # A temporary DevTools read failure must not select another game
            # page.  The conservative DOM fallback below can still choose a
            # single unambiguous page.
            pass

    focused: list[Any] = []
    visible: list[Any] = []
    for page in game_pages:
        try:
            state = await page.evaluate(
                "() => ({ focused: document.hasFocus(), visible: document.visibilityState === 'visible' })"
            )
        except Exception:
            state = {}
        if state.get("focused"):
            focused.append(page)
        if state.get("visible"):
            visible.append(page)

    if len(focused) == 1:
        return focused[0]
    if len(visible) == 1:
        return visible[0]
    if len(game_pages) == 1:
        return game_pages[0]

    raise BrowserAutomationError(
        "Открыто несколько активных вкладок Nemexia. Оставь нужную вкладку активной "
        "в одном окне браузера и нажми «Подключиться» ещё раз."
    )


async def _connect_to_active_tab(self: BrowserWorker, endpoint: str) -> dict[str, Any]:
    """Connect, then explicitly select the currently active Nemexia tab."""
    await _ORIGINAL_CONNECT(self, endpoint)
    page = await _choose_active_game_page(self)
    self._page = page
    return {
        "url": page.url,
        "pages": self._page_count(),
        "active": True,
    }


async def _select_active_game_page(self: BrowserWorker, create_if_missing: bool = False) -> Any:
    """Use only the tab currently selected in the browser.

    ``create_if_missing`` is deliberately ignored.  Opening a replacement tab
    or silently falling back to another account would violate the active-tab
    rule and could send actions from the wrong account.
    """
    del create_if_missing
    page = await _choose_active_game_page(self)
    self._page = page
    return page


def install_bound_tab_fix() -> None:
    global _INSTALLED
    if _INSTALLED:
        return
    BrowserWorker.connect = _connect_to_active_tab
    BrowserWorker._select_nemexia_page = _select_active_game_page
    _INSTALLED = True
