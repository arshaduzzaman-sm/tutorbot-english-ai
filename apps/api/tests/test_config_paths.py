"""The default recordings folder works from the repository and inside the Docker image (/app/app/core)."""

from pathlib import Path
from unittest.mock import patch

from app.core import config


def test_recordings_path_default_and_override(tmp_path: Path) -> None:
    s = config.Settings(recordings_dir="")
    assert s.recordings_path == Path(config.__file__).resolve().parents[4] / "recordings"
    assert config.Settings(recordings_dir=str(tmp_path)).recordings_path == tmp_path


def test_recordings_path_in_a_shallow_install() -> None:
    with (
        patch.object(config, "__file__", "/app/app/core/config.py"),
        patch.object(Path, "cwd", return_value=Path("/app")),
    ):
        assert config.Settings(recordings_dir="").recordings_path == Path("/app/recordings")
