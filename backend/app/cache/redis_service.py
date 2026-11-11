from __future__ import annotations

import json
import logging
import os
import threading
from typing import Any

import redis

from app.metrics import record_redis_cache_hit, record_redis_cache_miss

logger = logging.getLogger(__name__)


class RedisCacheService:
    def __init__(
        self,
        *,
        redis_url: str | None = None,
        channel: str | None = None,
        region: str | None = None,
        redis_client: redis.Redis | None = None,
    ) -> None:
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.channel = channel or os.getenv("REDIS_PUBSUB_CHANNEL", "feature-flags")
        self.region = region or os.getenv("APP_REGION", "region-a")
        self.redis_client = redis_client or self._connect()
        self._pubsub = None
        self._listener_thread: threading.Thread | None = None
        self._listener_stop = threading.Event()

    def _connect(self) -> redis.Redis | None:
        try:
            client = redis.Redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=1,
            )
            client.ping()
            logger.info("Redis connected for region %s", self.region)
            return client
        except Exception as exc:  # pragma: no cover - runtime defensive branch
            logger.warning("Redis unavailable for region %s at %s: %s", self.region, self.redis_url, exc)
            return None

    def available(self) -> bool:
        return self.redis_client is not None

    def _flag_cache_key(self, flag_key: str, environment: str | None = None) -> str:
        environment_segment = environment or "all"
        return f"feature-flag:{self.region}:{environment_segment}:{flag_key}"

    def _list_cache_key(self, environment: str | None = None) -> str:
        environment_segment = environment or "all"
        return f"feature-flags:{self.region}:{environment_segment}:list"

    def get_flag_config(self, flag_key: str, environment: str | None = None) -> dict[str, Any] | None:
        if self.redis_client is None:
            logger.warning("Redis cache miss for %s because Redis is unavailable", flag_key)
            record_redis_cache_miss("flag_config")
            return None

        key = self._flag_cache_key(flag_key, environment)
        try:
            raw_value = self.redis_client.get(key)
        except Exception as exc:  # pragma: no cover - runtime defensive branch
            logger.warning("Redis cache read failed for %s: %s", key, exc)
            record_redis_cache_miss("flag_config")
            return None

        if raw_value is None:
            logger.info("Redis cache miss for flag %s in region %s", flag_key, self.region)
            record_redis_cache_miss("flag_config")
            return None

        try:
            payload = json.loads(raw_value)
        except (TypeError, ValueError) as exc:  # pragma: no cover - runtime defensive branch
            logger.warning("Malformed Redis cache payload for %s: %s", key, exc)
            record_redis_cache_miss("flag_config")
            return None

        logger.info("Redis cache hit for flag %s in region %s", flag_key, self.region)
        record_redis_cache_hit("flag_config")
        return payload

    def set_flag_config(self, flag_key: str, payload: dict[str, Any], environment: str | None = None, ttl: int = 300) -> None:
        if self.redis_client is None:
            logger.warning("Redis cache write skipped for %s because Redis is unavailable", flag_key)
            return

        key = self._flag_cache_key(flag_key, environment)
        try:
            self.redis_client.set(key, json.dumps(payload), ex=ttl)
            logger.info("Redis cache refreshed for flag %s in region %s", flag_key, self.region)
        except Exception as exc:  # pragma: no cover - runtime defensive branch
            logger.warning("Redis cache write failed for %s: %s", key, exc)

    def invalidate_flag(self, flag_key: str, environment: str | None = None) -> None:
        if self.redis_client is None:
            logger.warning("Redis invalidation skipped for %s because Redis is unavailable", flag_key)
            return

        keys = [self._flag_cache_key(flag_key, environment), self._list_cache_key(environment)]
        try:
            self.redis_client.delete(*keys)
            logger.info("Redis cache invalidated for flag %s in region %s", flag_key, self.region)
        except Exception as exc:  # pragma: no cover - runtime defensive branch
            logger.warning("Redis invalidation failed for %s: %s", flag_key, exc)

    def set_list_cache(self, payload: list[dict[str, Any]], environment: str | None = None, ttl: int = 300) -> None:
        if self.redis_client is None:
            logger.warning("Redis list cache write skipped for environment %s because Redis is unavailable", environment)
            return

        key = self._list_cache_key(environment)
        try:
            self.redis_client.set(key, json.dumps(payload), ex=ttl)
            logger.info("Redis list cache refreshed for environment %s in region %s", environment, self.region)
        except Exception as exc:  # pragma: no cover - runtime defensive branch
            logger.warning("Redis list cache write failed for %s: %s", key, exc)

    def get_list_cache(self, environment: str | None = None) -> list[dict[str, Any]] | None:
        if self.redis_client is None:
            logger.warning("Redis list cache read skipped for environment %s because Redis is unavailable", environment)
            record_redis_cache_miss("list_config")
            return None

        key = self._list_cache_key(environment)
        try:
            raw_value = self.redis_client.get(key)
        except Exception as exc:  # pragma: no cover - runtime defensive branch
            logger.warning("Redis list cache read failed for %s: %s", key, exc)
            record_redis_cache_miss("list_config")
            return None

        if raw_value is None:
            logger.info("Redis list cache miss for environment %s in region %s", environment, self.region)
            record_redis_cache_miss("list_config")
            return None

        try:
            payload = json.loads(raw_value)
        except (TypeError, ValueError) as exc:  # pragma: no cover - runtime defensive branch
            logger.warning("Malformed Redis list payload for %s: %s", key, exc)
            record_redis_cache_miss("list_config")
            return None

        logger.info("Redis list cache hit for environment %s in region %s", environment, self.region)
        record_redis_cache_hit("list_config")
        return payload

    def publish_flag_event(self, *, action: str, flag_key: str, region: str, environment: str | None = None, payload: dict[str, Any] | None = None) -> None:
        if self.redis_client is None:
            logger.warning("Redis pub/sub skipped for %s because Redis is unavailable", flag_key)
            return

        event = {
            "event": "feature_flag_event",
            "action": action,
            "flag_key": flag_key,
            "region": region,
            "environment": environment,
            "payload": payload,
            "source_region": self.region,
        }
        try:
            self.redis_client.publish(self.channel, json.dumps(event))
            logger.info("Redis pub/sub published %s for %s from region %s", action, flag_key, self.region)
        except Exception as exc:  # pragma: no cover - runtime defensive branch
            logger.warning("Redis pub/sub publish failed for %s: %s", flag_key, exc)

    def handle_pubsub_message(self, message: dict[str, Any]) -> None:
        if not isinstance(message, dict):
            logger.warning("Received invalid Redis pub/sub message payload: %s", message)
            return

        if message.get("event") != "feature_flag_event":
            return

        source_region = message.get("source_region") or message.get("region")
        if source_region == self.region:
            return

        flag_key = message.get("flag_key")
        if not flag_key:
            logger.warning("Redis pub/sub message missing flag_key: %s", message)
            return

        logger.info("Handling Redis pub/sub event for flag %s from region %s", flag_key, source_region)
        environment = message.get("environment")
        self.invalidate_flag(flag_key, environment)
        payload = message.get("payload")
        if isinstance(payload, dict):
            self.set_flag_config(flag_key, payload, environment)

    def _listen_loop(self) -> None:
        if self.redis_client is None or self._pubsub is None:
            return

        while not self._listener_stop.is_set():
            try:
                item = self._pubsub.get_message(timeout=1, ignore_subscribe_messages=True)
            except redis.exceptions.TimeoutError:
                continue
            except Exception as exc:  # pragma: no cover - runtime defensive branch
                logger.warning("Redis pub/sub listener interrupted: %s", exc)
                break

            if item is None or item.get("type") != "message":
                continue

            raw_message = item.get("data")
            if not raw_message:
                continue

            try:
                payload = json.loads(raw_message)
            except (TypeError, ValueError):
                logger.warning("Failed to decode Redis pub/sub message: %s", raw_message)
                continue

            self.handle_pubsub_message(payload)

    def start_listener(self) -> None:
        if self.redis_client is None:
            logger.warning("Redis listener not started because Redis is unavailable")
            return

        if self._listener_thread and self._listener_thread.is_alive():
            return

        self._pubsub = self.redis_client.pubsub(ignore_subscribe_messages=True)
        self._pubsub.subscribe(self.channel)
        self._listener_stop.clear()
        self._listener_thread = threading.Thread(target=self._listen_loop, daemon=True, name="redis-pubsub-listener")
        self._listener_thread.start()
        logger.info("Redis pub/sub listener started on channel %s", self.channel)

    def stop_listener(self) -> None:
        self._listener_stop.set()
        if self._pubsub is not None:
            try:
                self._pubsub.close()
            except Exception:  # pragma: no cover - runtime defensive branch
                pass
            self._pubsub = None


from app.config import settings

cache_service = RedisCacheService(
    redis_url=settings.redis_url,
    channel=settings.redis_pubsub_channel,
    region=settings.app_region,
)
