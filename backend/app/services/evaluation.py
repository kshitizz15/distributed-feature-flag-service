
from __future__ import annotations

import hashlib
from collections.abc import Mapping

from app.models import FeatureFlag


def stable_bucket(flag_key: str, user_id: str) -> float:
    """Generate a stable percentage bucket for each user and flag."""
    if not user_id:
        return 0.0

    digest = hashlib.sha256(
        f"{flag_key}:{user_id}".encode("utf-8")
    ).hexdigest()

    bucket = int(digest, 16) % 10_000
    return bucket / 100.0


def _flag_key(flag: FeatureFlag | Mapping[str, object]) -> str:
    if isinstance(flag, Mapping):
        return str(flag.get("key") or "")
    return str(flag.key)


def _flag_percentage(flag: FeatureFlag | Mapping[str, object]) -> float:
    if isinstance(flag, Mapping):
        value = flag.get("percentage", 0.0)
    else:
        value = flag.percentage

    return float(value or 0.0)


def _flag_enabled(flag: FeatureFlag | Mapping[str, object]) -> bool:
    if isinstance(flag, Mapping):
        return bool(flag.get("enabled", False))
    return bool(flag.enabled)


def _flag_environment(flag: FeatureFlag | Mapping[str, object]) -> str:
    if isinstance(flag, Mapping):
        env_name = flag.get("environment")
        return str(env_name) if env_name else "production"

    if getattr(flag, "environment", None) is not None:
        return str(flag.environment.name)

    return "production"


def _flag_rules(
    flag: FeatureFlag | Mapping[str, object]
) -> list[dict[str, object]]:

    if isinstance(flag, Mapping):
        rules = flag.get("targeting_rules") or []
    else:
        rules = flag.targeting_rules or []

    normalized: list[dict[str, object]] = []

    for rule in rules:
        if hasattr(rule, "attribute"):
            normalized.append({
                "attribute": getattr(rule, "attribute", ""),
                "operator": getattr(rule, "operator", "equals") or "equals",
                "value": getattr(rule, "value", ""),
                "rollout_percentage": getattr(
                    rule, "rollout_percentage", None
                ),
                "priority": getattr(rule, "priority", 0),
            })

        elif isinstance(rule, Mapping):
            normalized.append({
                "attribute": str(rule.get("attribute") or ""),
                "operator": str(rule.get("operator") or "equals"),
                "value": str(rule.get("value") or ""),
                "rollout_percentage": rule.get("rollout_percentage"),
                "priority": int(rule.get("priority") or 0),
            })

    return sorted(
        normalized,
        key=lambda item: int(item.get("priority") or 0),
        reverse=True,
    )


def _match_rule(
    rule: dict[str, object],
    user_id: str,
    environment: str,
    flag_key: str,
) -> bool:

    attribute = str(rule.get("attribute") or "").strip().lower()
    operator = str(rule.get("operator") or "equals").strip().lower()
    expected = str(rule.get("value") or "")

    context = {
        "user_id": user_id,
        "environment": environment,
        "flag_key": flag_key,
    }

    actual = context.get(attribute)

    if actual is None:
        return False

    actual_value = str(actual).lower()
    expected_value = expected.lower()

    if operator == "equals":
        return actual_value == expected_value

    if operator == "contains":
        return expected_value in actual_value

    if operator == "starts_with":
        return actual_value.startswith(expected_value)

    return False


def evaluate_feature_flag(
    flag: FeatureFlag | Mapping[str, object],
    user_id: str,
    default_value: bool = False,
) -> dict[str, object]:

    flag_key = _flag_key(flag)
    environment = _flag_environment(flag)
    percentile = _flag_percentage(flag)
    is_enabled = _flag_enabled(flag)

    if not user_id:
        return {
            "flag_key": flag_key,
            "user_id": user_id,
            "environment": environment,
            "enabled": bool(default_value),
            "percentage": percentile,
            "reason": "missing_user_id",
        }

    if not is_enabled:
        return {
            "flag_key": flag_key,
            "user_id": user_id,
            "environment": environment,
            "enabled": False,
            "percentage": percentile,
            "reason": "flag_disabled",
        }

    # Evaluate targeting rules before global percentage rollout.
    rules = _flag_rules(flag)

    for rule in rules:
        if _match_rule(rule, user_id, environment, flag_key):

            # A matching rule gets 100% rollout by default.
            # An explicitly configured rule percentage takes priority.
            configured_percentage = rule.get("rollout_percentage")

            if configured_percentage is None:
                rule_percentage = 100.0
            else:
                rule_percentage = max(
                    0.0,
                    min(100.0, float(configured_percentage)),
                )

            bucket = stable_bucket(flag_key, user_id)
            enabled = bucket < rule_percentage

            return {
                "flag_key": flag_key,
                "user_id": user_id,
                "environment": environment,
                "enabled": enabled,
                "percentage": rule_percentage,
                "reason": (
                    "targeting_rule_match"
                    if enabled
                    else "targeting_rule_excluded"
                ),
            }

    # No targeting rule matched: use global percentage rollout.
    bucket = stable_bucket(flag_key, user_id)
    enabled = bucket < percentile

    return {
        "flag_key": flag_key,
        "user_id": user_id,
        "environment": environment,
        "enabled": enabled,
        "percentage": percentile,
        "reason": (
            "percentage_rollout"
            if enabled
            else "percentage_excluded"
        ),
    }
