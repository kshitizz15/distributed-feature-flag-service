from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Environment(Base):
    __tablename__ = "environments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_production: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    flags: Mapped[list[FeatureFlag]] = relationship(back_populates="environment", cascade="all, delete-orphan")


class FeatureFlag(Base):
    __tablename__ = "feature_flags"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    key: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    percentage: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    environment_id: Mapped[str] = mapped_column(ForeignKey("environments.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    environment: Mapped[Environment] = relationship(back_populates="flags")
    targeting_rules: Mapped[list[TargetingRule]] = relationship(back_populates="feature_flag", cascade="all, delete-orphan")
    configuration_versions: Mapped[list[ConfigurationVersion]] = relationship(
        back_populates="feature_flag",
        cascade="all, delete-orphan",
    )


class TargetingRule(Base):
    __tablename__ = "targeting_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    feature_flag_id: Mapped[str] = mapped_column(ForeignKey("feature_flags.id"), nullable=False, index=True)
    attribute: Mapped[str] = mapped_column(String(64), nullable=False)
    operator: Mapped[str] = mapped_column(String(32), nullable=False, default="equals")
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    rollout_percentage: Mapped[float | None] = mapped_column(Float, nullable=True)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    feature_flag: Mapped[FeatureFlag] = relationship(back_populates="targeting_rules")


class ConfigurationVersion(Base):
    __tablename__ = "configuration_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    feature_flag_id: Mapped[str] = mapped_column(ForeignKey("feature_flags.id"), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    configuration: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    feature_flag: Mapped[FeatureFlag] = relationship(back_populates="configuration_versions")
