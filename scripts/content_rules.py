"""Question checks shared by the seed builder, the import script and the admin upload API.

The rules live in apps/api/app/services/content_rules.py (one copy). This file loads that module by path, so the
scripts keep working with plain python3 and no API dependencies.
"""

import importlib.util
from pathlib import Path

_PATH = Path(__file__).resolve().parent.parent / "apps" / "api" / "app" / "services" / "content_rules.py"
_spec = importlib.util.spec_from_file_location("tutorbot_content_rules", _PATH)
assert _spec and _spec.loader
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

DIFFICULTIES = _mod.DIFFICULTIES
STATUSES = _mod.STATUSES
check_question = _mod.check_question
