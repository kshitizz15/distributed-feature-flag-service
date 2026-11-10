from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.cache import cache_service
from app.database import get_db
from app.models import ConfigurationVersion, Environment, FeatureFlag, TargetingRule
from app.schemas import (
    FeatureFlagCreate,
    FeatureFlagEvaluationRequest,
    FeatureFlagEvaluationResponse,
    FeatureFlagRead,
    FeatureFlagUpdate,
    TargetingRuleRead,
)
from app.services.evaluation import evaluate_feature_flag, stable_bucket

router = APIRouter()


def _serialize_rule(rule: TargetingRule) -> dict[str, object]:
    return {
        "id": rule.id,
        "attribute": rule.attribute,
        "operator": rule.operator,
        "value": rule.value,
        "rollout_percentage": rule.rollout_percentage,
        "priority": rule.priority,
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
    }


def _serialize_flag(flag: FeatureFlag) -> dict[str, object]:
    return {
        "id": flag.id,
        "key": flag.key,
        "name": flag.name,
        "description": flag.description,
        "enabled": flag.enabled,
        "percentage": float(flag.percentage),
        "environment": flag.environment.name if flag.environment else None,
        "targeting_rules": [_serialize_rule(rule) for rule in (flag.targeting_rules or [])],
        "created_at": flag.created_at.isoformat() if flag.created_at else None,
        "updated_at": flag.updated_at.isoformat() if flag.updated_at else None,
    }


def _get_or_create_environment(db: Session, name: str) -> Environment:
    statement = select(Environment).where(Environment.name == name)
    environment = db.execute(statement).scalar_one_or_none()
    if environment is not None:
        return environment

    environment = Environment(name=name, description=f"Environment: {name}", is_production=name == "production")
    db.add(environment)
    db.commit()
    db.refresh(environment)
    return environment


def _evaluate_cached_flag(flag_payload: dict[str, object], user_id: str, default_value: bool) -> dict[str, object]:
    percentage = float(flag_payload.get("percentage", 0.0))
    bucket = stable_bucket(str(flag_payload.get("key", "")), user_id)
    enabled = bool(flag_payload.get("enabled", False) and bucket < percentage)

    if not flag_payload.get("enabled", False):
        reason = "flag_disabled"
    elif bucket < percentage:
        reason = "percentage_rollout"
    else:
        reason = "percentage_excluded"

    if not user_id:
        enabled = bool(default_value)
        reason = "missing_user_id"

    return {
        "flag_key": flag_payload.get("key"),
        "user_id": user_id,
        "environment": flag_payload.get("environment"),
        "enabled": enabled,
        "percentage": percentage,
        "reason": reason,
    }


@router.get("/feature-flags", response_model=list[FeatureFlagRead])
def list_feature_flags(
    environment: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    cached_flags = cache_service.get_list_cache(environment)
    if cached_flags is not None:
        return cached_flags

    statement = select(FeatureFlag)
    if environment:
        statement = statement.join(Environment).where(Environment.name == environment)
    statement = statement.order_by(FeatureFlag.name)

    flags = db.execute(statement).scalars().all()
    payload = [_serialize_flag(flag) for flag in flags]
    cache_service.set_list_cache(payload, environment)
    return payload


@router.get("/feature-flags/{flag_key}", response_model=FeatureFlagRead)
def get_feature_flag(flag_key: str, db: Session = Depends(get_db)):
    cached_flag = cache_service.get_flag_config(flag_key)
    if cached_flag is not None:
        return cached_flag

    statement = select(FeatureFlag).where(FeatureFlag.key == flag_key)
    flag = db.execute(statement).scalar_one_or_none()
    if flag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Feature flag '{flag_key}' was not found.")

    payload = _serialize_flag(flag)
    cache_service.set_flag_config(flag_key, payload, payload.get("environment"))
    return payload


@router.post("/feature-flags", response_model=FeatureFlagRead, status_code=status.HTTP_201_CREATED)
def create_feature_flag(payload: FeatureFlagCreate, db: Session = Depends(get_db)):
    existing = db.execute(select(FeatureFlag).where(FeatureFlag.key == payload.key)).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Feature flag '{payload.key}' already exists.")

    environment = _get_or_create_environment(db, payload.environment)
    flag = FeatureFlag(
        key=payload.key,
        name=payload.name,
        description=payload.description,
        enabled=payload.enabled,
        percentage=float(payload.percentage),
        environment_id=environment.id,
    )
    db.add(flag)
    db.flush()

    for rule_data in payload.targeting_rules:
        rule = TargetingRule(
            feature_flag_id=flag.id,
            attribute=rule_data.attribute,
            operator=rule_data.operator,
            value=rule_data.value,
            rollout_percentage=rule_data.rollout_percentage,
            priority=rule_data.priority,
        )
        db.add(rule)

    version = ConfigurationVersion(
        feature_flag_id=flag.id,
        version=1,
        configuration={
            "key": payload.key,
            "name": payload.name,
            "description": payload.description,
            "enabled": payload.enabled,
            "percentage": float(payload.percentage),
            "environment": payload.environment,
            "targeting_rules": [rule.model_dump() for rule in payload.targeting_rules],
        },
    )
    db.add(version)
    db.commit()
    db.refresh(flag)

    serialized_flag = _serialize_flag(flag)
    cache_service.invalidate_flag(payload.key, payload.environment)
    cache_service.set_flag_config(payload.key, serialized_flag, payload.environment)
    cache_service.publish_flag_event(
        action="created",
        flag_key=payload.key,
        region=cache_service.region,
        environment=payload.environment,
        payload=serialized_flag,
    )
    return serialized_flag


@router.patch("/feature-flags/{flag_key}", response_model=FeatureFlagRead)
def update_feature_flag(flag_key: str, payload: FeatureFlagUpdate, db: Session = Depends(get_db)):
    statement = select(FeatureFlag).where(FeatureFlag.key == flag_key)
    flag = db.execute(statement).scalar_one_or_none()
    if flag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Feature flag '{flag_key}' was not found.")

    initial_environment = flag.environment.name if flag.environment else None
    if payload.key is not None and payload.key != flag.key:
        existing = db.execute(select(FeatureFlag).where(FeatureFlag.key == payload.key)).scalar_one_or_none()
        if existing is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Feature flag '{payload.key}' already exists.")
        flag.key = payload.key

    if payload.name is not None:
        flag.name = payload.name
    if payload.description is not None:
        flag.description = payload.description
    if payload.enabled is not None:
        flag.enabled = payload.enabled
    if payload.percentage is not None:
        flag.percentage = float(payload.percentage)
    if payload.environment is not None:
        environment = _get_or_create_environment(db, payload.environment)
        flag.environment_id = environment.id

    if payload.targeting_rules is not None:
        db.query(TargetingRule).filter(TargetingRule.feature_flag_id == flag.id).delete()
        for rule_data in payload.targeting_rules:
            rule = TargetingRule(
                feature_flag_id=flag.id,
                attribute=rule_data.attribute,
                operator=rule_data.operator,
                value=rule_data.value,
                rollout_percentage=rule_data.rollout_percentage,
                priority=rule_data.priority,
            )
            db.add(rule)

    version_number = 1
    latest_version = db.execute(
        select(ConfigurationVersion.version)
        .where(ConfigurationVersion.feature_flag_id == flag.id)
        .order_by(ConfigurationVersion.version.desc())
        .limit(1)
    ).scalar_one_or_none()
    if latest_version is not None:
        version_number = latest_version + 1

    config_payload = {
        "key": flag.key,
        "name": flag.name,
        "description": flag.description,
        "enabled": flag.enabled,
        "percentage": float(flag.percentage),
        "environment": flag.environment.name if flag.environment else None,
        "targeting_rules": [rule.model_dump() for rule in payload.targeting_rules] if payload.targeting_rules else [],
    }
    db.add(ConfigurationVersion(feature_flag_id=flag.id, version=version_number, configuration=config_payload))
    db.commit()
    db.refresh(flag)

    serialized_flag = _serialize_flag(flag)
    target_environment = payload.environment or initial_environment or serialized_flag.get("environment")
    cache_service.invalidate_flag(flag.key, target_environment)
    cache_service.set_flag_config(flag.key, serialized_flag, target_environment)
    cache_service.publish_flag_event(
        action="updated",
        flag_key=flag.key,
        region=cache_service.region,
        environment=target_environment,
        payload=serialized_flag,
    )
    return serialized_flag


@router.delete("/feature-flags/{flag_key}", status_code=status.HTTP_204_NO_CONTENT)
def delete_feature_flag(flag_key: str, db: Session = Depends(get_db)):
    flag = db.execute(select(FeatureFlag).where(FeatureFlag.key == flag_key)).scalar_one_or_none()
    if flag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Feature flag '{flag_key}' was not found.")

    delete_environment = flag.environment.name if flag.environment else None
    db.delete(flag)
    db.commit()

    cache_service.invalidate_flag(flag_key, delete_environment)
    cache_service.publish_flag_event(
        action="deleted",
        flag_key=flag_key,
        region=cache_service.region,
        environment=delete_environment,
        payload={"key": flag_key, "environment": delete_environment},
    )


@router.post("/evaluate", response_model=FeatureFlagEvaluationResponse)
def evaluate_feature_flag_endpoint(payload: FeatureFlagEvaluationRequest, db: Session = Depends(get_db)):
    environment_name = payload.environment or "production"
    cached_flag = cache_service.get_flag_config(payload.flag_key, environment_name)
    if cached_flag is not None:
        result = _evaluate_cached_flag(cached_flag, payload.user_id, payload.default_value)
        return {
            "flag_key": result["flag_key"],
            "user_id": result["user_id"],
            "environment": result["environment"],
            "enabled": result["enabled"],
            "percentage": result["percentage"],
            "reason": result["reason"],
        }

    environment = db.execute(select(Environment).where(Environment.name == environment_name)).scalar_one_or_none()
    if environment is None:
        environment = _get_or_create_environment(db, environment_name)

    flag = db.execute(
        select(FeatureFlag)
        .where(FeatureFlag.key == payload.flag_key)
        .where(FeatureFlag.environment_id == environment.id)
    ).scalar_one_or_none()
    if flag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Feature flag '{payload.flag_key}' was not found in environment '{environment_name}'.")

    result = evaluate_feature_flag(flag, payload.user_id, payload.default_value)
    cache_service.set_flag_config(payload.flag_key, _serialize_flag(flag), environment_name)
    return {
        "flag_key": result["flag_key"],
        "user_id": result["user_id"],
        "environment": result["environment"],
        "enabled": result["enabled"],
        "percentage": result["percentage"],
        "reason": result["reason"],
    }
