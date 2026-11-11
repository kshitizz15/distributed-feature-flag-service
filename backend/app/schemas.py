from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TargetingRuleCreate(BaseModel):
    attribute: str = Field(..., min_length=1, max_length=64)
    operator: str = Field(default="equals", min_length=1, max_length=32)
    value: str = Field(..., min_length=1, max_length=255)
    rollout_percentage: float | None = Field(default=None, ge=0.0, le=100.0)
    priority: int = Field(default=0, ge=0)


class TargetingRuleRead(TargetingRuleCreate):
    id: str
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class FeatureFlagBase(BaseModel):
    key: str = Field(..., min_length=1, max_length=128)
    name: str = Field(..., min_length=1, max_length=128)
    description: str | None = None
    enabled: bool = False
    percentage: float = Field(default=0.0, ge=0.0, le=100.0)
    environment: str = "production"
    targeting_rules: list[TargetingRuleCreate] = Field(default_factory=list)


class FeatureFlagCreate(FeatureFlagBase):
    pass


class FeatureFlagUpdate(BaseModel):
    key: str | None = Field(default=None, min_length=1, max_length=128)
    name: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = None
    enabled: bool | None = None
    percentage: float | None = Field(default=None, ge=0.0, le=100.0)
    environment: str | None = None
    targeting_rules: list[TargetingRuleCreate] | None = None


class FeatureFlagRead(BaseModel):
    id: str
    key: str
    name: str
    description: str | None = None
    enabled: bool
    percentage: float
    environment: str
    targeting_rules: list[TargetingRuleRead] = Field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class FeatureFlagEvaluationRequest(BaseModel):
    flag_key: str = Field(..., min_length=1, max_length=128)
    user_id: str = Field(..., min_length=1, max_length=255)
    environment: str | None = None
    default_value: bool = False


class FeatureFlagEvaluationResponse(BaseModel):
    flag_key: str
    user_id: str
    environment: str
    enabled: bool
    percentage: float
    reason: str
    region: str | None = None
