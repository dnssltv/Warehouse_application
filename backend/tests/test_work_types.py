from starlette.testclient import TestClient

from .helpers import auth_headers


def test_list_work_types_as_admin(client: TestClient, admin_token: str) -> None:
    r = client.get("/api/work-types", headers=auth_headers(admin_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)
