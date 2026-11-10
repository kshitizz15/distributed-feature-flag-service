from __future__ import annotations

import hashlib

from app.models import FeatureFlag


def stable_bucket(flag_key: str, user_id: str) -> float:
    digest = hashlib.sha256(f"{flag_key}:{user_id}".encode("utf-8")).hexdigest()
    bucket = int(digest, 16) % 10_000
    return bucket / 100.0


def evaluate_feature_flag(flag: FeatureFlag, user_id: str, default_value: bool = False) -> dict[str, object]:
    percentile = float(flag.percentage)
    bucket = stable_bucket(flag.key, user_id)
    enabled = bool(flag.enabled and bucket < percentile)

    if not flag.enabled:
        reason = "flag_disabled"
    elif bucket < percentile:
        reason = "percentage_rollout"
    else:
        reason = "percentage_excluded"

    if not user_id:
        enabled = bool(default_value)
        reason = "missing_user_id"

    return {
        "flag_key": flag.key,
        "user_id": user_id,
        "environment": flag.environment.name,
        "enabled": enabled,
        "percentage": percentile,
        "reason": reason,
    }
