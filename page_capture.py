from __future__ import annotations

import json
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


def application_directory(
    *,
    frozen: bool | None = None,
    executable: str | Path | None = None,
    module_file: str | Path | None = None,
) -> Path:
    """Return the folder containing the source project or the built executable."""
    is_frozen = bool(getattr(sys, "frozen", False)) if frozen is None else bool(frozen)
    if is_frozen:
        return Path(executable or sys.executable).resolve().parent
    return Path(module_file or __file__).resolve().parent


def default_snapshot_root() -> Path:
    """Keep manual snapshots next to the project or packaged application."""
    return application_directory() / "saved_pages"


async def _focused_game_page(worker: Any):
    """Use the same active-tab resolver as every game action."""
    selector = getattr(worker, "_select_nemexia_page", None)
    if not callable(selector):
        raise RuntimeError("Вкладка Nemexia не выбрана")
    return await selector()


def _cleanup_snapshots(root: Path, keep: int) -> None:
    snapshots = sorted(
        (path for path in root.iterdir() if path.is_dir()),
        key=lambda path: path.name,
        reverse=True,
    )
    for old in snapshots[max(1, int(keep)):]:
        shutil.rmtree(old, ignore_errors=True)


async def capture_page(
    page: Any,
    root: Path,
    *,
    keep: int | None = 10,
    folder_name: str | None = None,
    metadata_extra: dict[str, Any] | None = None,
) -> dict[str, str]:
    """Save one already selected page without changing the browser focus.

    Battle reports are opened in popup tabs.  Resolving the "active" Nemexia
    page at capture time is unsafe because the resolver deliberately prefers
    ``fleets.php``.  Callers therefore pass the exact report page here.  A
    ``None`` retention value disables cleanup; this is used for the append-only
    battle archive while manual page snapshots keep their old ten-item limit.
    """
    root.mkdir(parents=True, exist_ok=True)

    now = datetime.now().astimezone()
    default_name = now.strftime("%Y-%m-%d_%H-%M-%S-%f")[:-3]
    folder = root / (folder_name or default_name)
    # A caller-provided run id normally makes the directory unique.  Keep the
    # helper safe for repeated names in tests or after a resumed batch.
    if folder.exists():
        folder = root / f"{folder.name}_{now.strftime('%f')}"
    folder.mkdir(parents=True, exist_ok=False)

    screenshot_path = folder / "screenshot.png"
    html_path = folder / "page.html"
    mhtml_path = folder / "page.mhtml"
    metadata_path = folder / "metadata.json"

    warnings: list[str] = []
    title = ""
    try:
        title = await page.title()
    except Exception as exc:
        warnings.append(f"Не прочитан заголовок: {exc}")

    try:
        await page.screenshot(path=str(screenshot_path), full_page=True)
    except Exception as exc:
        warnings.append(f"Не сохранён скриншот: {exc}")

    try:
        html_path.write_text(await page.content(), encoding="utf-8")
    except Exception as exc:
        warnings.append(f"Не сохранён HTML: {exc}")

    session = None
    try:
        session = await page.context.new_cdp_session(page)
        snapshot = await session.send("Page.captureSnapshot", {"format": "mhtml"})
        data = str(snapshot.get("data") or "")
        if not data:
            raise RuntimeError("Chromium вернул пустой MHTML")
        mhtml_path.write_text(data, encoding="utf-8")
    except Exception as exc:
        warnings.append(f"Не сохранён MHTML: {exc}")
    finally:
        if session is not None:
            try:
                await session.detach()
            except Exception:
                pass

    metadata = {
        "captured_at": now.isoformat(),
        "url": page.url,
        "title": title,
        "warnings": warnings,
        "files": {
            "screenshot": screenshot_path.name if screenshot_path.exists() else None,
            "html": html_path.name if html_path.exists() else None,
            "mhtml": mhtml_path.name if mhtml_path.exists() else None,
        },
    }
    if metadata_extra:
        metadata["context"] = metadata_extra
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

    if not any(path.exists() for path in (screenshot_path, html_path, mhtml_path)):
        shutil.rmtree(folder, ignore_errors=True)
        raise RuntimeError("Не удалось сохранить ни один файл страницы")

    if keep is not None:
        _cleanup_snapshots(root, keep)
    return {
        "folder": str(folder),
        "url": page.url,
        "title": title,
        "warnings": "\n".join(warnings),
    }


async def capture_current_page(worker: Any, root: Path, *, keep: int = 10) -> dict[str, str]:
    """Save the currently selected Nemexia page.

    This compatibility wrapper retains the old active-tab behaviour for the
    manual «Сохранить страницу» action.  Battle code must call
    :func:`capture_page` with its popup report page directly.
    """
    page = await _focused_game_page(worker)
    return await capture_page(page, root, keep=keep)
