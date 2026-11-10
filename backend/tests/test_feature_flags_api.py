import importlib

from fastapi.testclient import TestClient


def build_app(monkeypatch, tmp_path):
    db_url = f"sqlite:///{tmp_path / 'feature_flags.sqlite3'}"
    monkeypatch.setenv("DATABASE_URL", db_url)
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("APP_REGION", "region-test")

    import app.config as config_module
    import app.database as database_module
    import app.main as main_module
    import app.models as models_module

    importlib.reload(config_module)
    importlib.reload(database_module)
    importlib.reload(models_module)
    importlib.reload(main_module)

    database_module.init_db()
    return main_module.app, database_module


def test_health_route(monkeypatch, tmp_path):
    app, _ = build_app(monkeypatch, tmp_path)
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["database"] == "connected"


def test_create_and_list_feature_flags(monkeypatch, tmp_path):
    app, _ = build_app(monkeypatch, tmp_path)
    client = TestClient(app)

    payload = {
        "key": "new_checkout",
        "name": "New Checkout",
        "description": "A new checkout flow",
        "environment": "production",
        "enabled": True,
        "percentage": 100,
    }

    create_response = client.post("/api/v1/feature-flags", json=payload)
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["key"] == "new_checkout"
    assert created["environment"] == "production"

    list_response = client.get("/api/v1/feature-flags")
    assert list_response.status_code == 200
    flags = list_response.json()
    assert any(flag["key"] == "new_checkout" for flag in flags)


def test_evaluate_endpoint_is_deterministic(monkeypatch, tmp_path):
    app, _ = build_app(monkeypatch, tmp_path)
    client = TestClient(app)

    client.post(
        "/api/v1/feature-flags",
        json={
            "key": "beta_dashboard",
            "name": "Beta Dashboard",
            "environment": "production",
            "enabled": True,
            "percentage": 50,
        },
    )

    req = {"flag_key": "beta_dashboard", "user_id": "user-123", "environment": "production"}
    first = client.post("/api/v1/evaluate", json=req)
    second = client.post("/api/v1/evaluate", json=req)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["enabled"] == second.json()["enabled"]
    assert "percentage" in first.json()
