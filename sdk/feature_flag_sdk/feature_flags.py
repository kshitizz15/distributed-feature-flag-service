from __future__ import annotations

from typing import Any, Dict, Optional


class FeatureFlagEvaluator:
    def __init__(self, flags: Optional[Dict[str, Any]] = None):
        self._flags = dict(flags or {})

    def register(self, name: str, enabled: bool) -> None:
        self._flags[name] = enabled

    def is_enabled(self, name: str, default: bool = False) -> bool:
        return bool(self._flags.get(name, default))

    def get_flags(self) -> Dict[str, Any]:
        return dict(self._flags)
