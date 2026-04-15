from starlette.testclient import TestClient


def test_root_ok(client: TestClient) -> None:
    r = client.get("/")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "ok"
    assert "warehouse" in data.get("service", "").lower()
