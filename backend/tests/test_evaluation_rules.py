from app.models import Environment, FeatureFlag, TargetingRule
from app.services.evaluation import evaluate_feature_flag, stable_bucket


def _make_flag(*, key: str = "checkout.v2", percentage: float = 0.0, enabled: bool = True, rules: list[TargetingRule] | None = None):
    env = Environment(name="development", description="Development env", is_production=False)
    flag = FeatureFlag(
        key=key,
        name="Checkout V2",
        description="New checkout",
        enabled=enabled,
        percentage=percentage,
        environment=env,
        targeting_rules=rules or [],
    )
    return flag


def test_percentage_rollout_boundaries_are_stable():
    flag = _make_flag(key="beta_dashboard", percentage=20)

    for user_id in ["user-000", "user-001", "user-002", "user-003", "user-004"]:
        result = evaluate_feature_flag(flag, user_id)
        expected = stable_bucket(flag.key, user_id) < 20
        assert result["enabled"] == expected

    zero_flag = _make_flag(key="zero_gate", percentage=0)
    assert evaluate_feature_flag(zero_flag, "user-999")["enabled"] is False

    hundred_flag = _make_flag(key="hundred_gate", percentage=100)
    assert evaluate_feature_flag(hundred_flag, "user-999")["enabled"] is True


def test_targeting_rules_support_equals_contains_and_starts_with():
    rules = [
        TargetingRule(attribute="user_id", operator="equals", value="beta-user", rollout_percentage=100.0, priority=10),
        TargetingRule(attribute="user_id", operator="contains", value="beta", rollout_percentage=100.0, priority=9),
        TargetingRule(attribute="user_id", operator="starts_with", value="pilot-", rollout_percentage=100.0, priority=8),
    ]
    flag = _make_flag(key="pilot_feature", percentage=0, rules=rules)

    assert evaluate_feature_flag(flag, "beta-user")["enabled"] is True
    assert evaluate_feature_flag(flag, "live-beta-user")["enabled"] is True
    assert evaluate_feature_flag(flag, "pilot-42")["enabled"] is True
    assert evaluate_feature_flag(flag, "guest-user")["enabled"] is False


def test_targeting_rule_rollout_can_override_global_percentage():
    flag = _make_flag(
        key="rule_override",
        percentage=0,
        rules=[
            TargetingRule(attribute="user_id", operator="starts_with", value="admin-", rollout_percentage=100.0, priority=20),
        ],
    )

    assert evaluate_feature_flag(flag, "admin-42")["enabled"] is True
    assert evaluate_feature_flag(flag, "staff-42")["enabled"] is False
