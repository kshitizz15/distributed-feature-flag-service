import json

from app.cache.redis_service import RedisCacheService


class FakePubSub:
    def __init__(self, client):
        self.client = client
        self.channels = []

    def subscribe(self, channel):
        self.channels.append(channel)

    def listen(self):
        return iter(())

    def close(self):
        pass


class FakeRedis:
    def __init__(self):
        self.store = {}
        self.published = []

    def ping(self):
        return True

    def get(self, key):
        return self.store.get(key)

    def set(self, key, value, ex=None):
        self.store[key] = value
        return True

    def delete(self, *keys):
        removed = 0
        for key in keys:
            if key in self.store:
                del self.store[key]
                removed += 1
        return removed

    def publish(self, channel, message):
        self.published.append((channel, message))
        return 1

    def pubsub(self, ignore_subscribe_messages=True):
        return FakePubSub(self)


def test_redis_cache_hit_and_miss():
    client = FakeRedis()
    service = RedisCacheService(redis_client=client, region="region-a", channel="feature-flags")

    payload = {"key": "beta_dashboard", "enabled": True, "percentage": 50, "environment": "production"}
    service.set_flag_config("beta_dashboard", payload, "production")

    assert service.get_flag_config("beta_dashboard", "production") == payload
    assert service.get_flag_config("unknown_flag", "production") is None


def test_redis_cache_invalidation_after_update():
    client = FakeRedis()
    service = RedisCacheService(redis_client=client, region="region-b", channel="feature-flags")

    payload = {"key": "new_checkout", "enabled": True, "percentage": 100, "environment": "production"}
    service.set_flag_config("new_checkout", payload, "production")
    service.invalidate_flag("new_checkout", "production")

    assert service.get_flag_config("new_checkout", "production") is None


def test_pubsub_message_handling_refreshes_remote_cache():
    client = FakeRedis()
    service = RedisCacheService(redis_client=client, region="region-b", channel="feature-flags")

    message = {
        "event": "feature_flag_event",
        "flag_key": "checkout_v2",
        "environment": "production",
        "source_region": "region-a",
        "payload": {"key": "checkout_v2", "enabled": True, "percentage": 25, "environment": "production"},
    }

    service.handle_pubsub_message(message)

    assert service.get_flag_config("checkout_v2", "production") == message["payload"]


def test_redis_unavailable_fallback_does_not_crash():
    service = RedisCacheService(redis_url="redis://localhost:1", region="region-a", channel="feature-flags")

    assert service.available() is False
    assert service.get_flag_config("missing", "production") is None
    service.set_flag_config("missing", {"key": "missing"}, "production")
    service.invalidate_flag("missing", "production")
    service.publish_flag_event(action="updated", flag_key="missing", region="region-a", environment="production", payload={"key": "missing"})
    service.start_listener()
    service.stop_listener()
