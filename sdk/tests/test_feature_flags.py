from feature_flag_sdk.feature_flags import FeatureFlagEvaluator


def test_flag_default_false():
    evaluator = FeatureFlagEvaluator()
    assert evaluator.is_enabled("new_ui") is False

def test_flag_registration():
    evaluator = FeatureFlagEvaluator()
    evaluator.register("beta_dashboard", True)
    assert evaluator.is_enabled("beta_dashboard") is True
