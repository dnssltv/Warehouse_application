"""Права ролей и фильтрация списков заявок по площадке."""

from __future__ import annotations

from starlette.testclient import TestClient

from .helpers import auth_headers, create_user, login


def test_warehouse_manager_cannot_assign_agc_request(
    client: TestClient,
    admin_headers: dict[str, str],
) -> None:
    create_user(
        client,
        admin_headers,
        email="r1@example.com",
        password="Passw0rd!X",
        role="requester",
        first_name="Req",
        last_name="One",
    )
    create_user(
        client,
        admin_headers,
        email="wm@example.com",
        password="Passw0rd!X",
        role="warehouse_manager",
        first_name="Wh",
        last_name="Mgr",
    )

    req_tok = login(client, "r1@example.com", "Passw0rd!X")
    mgr_tok = login(client, "wm@example.com", "Passw0rd!X")

    cr = client.post(
        "/api/requests",
        headers=auth_headers(req_tok),
        json={
            "item_qty": 1,
            "fulfillment_site": "stock_in_agc",
            "priority": "normal",
        },
    )
    assert cr.status_code == 200
    req_id = cr.json()["id"]

    me_mgr = client.get("/api/auth/me", headers=auth_headers(mgr_tok)).json()
    # нужен кладовщик AGC для валидного assignee_ids — но роль менеджера склада уже должна отсечься раньше
    op_agc = create_user(
        client,
        admin_headers,
        email="tmpagc@example.com",
        password="Passw0rd!X",
        role="warehouse_operator_agc",
        first_name="Op",
        last_name="Agc",
    )

    r = client.post(
        f"/api/requests/{req_id}/assign",
        headers=auth_headers(mgr_tok),
        json={"manager_id": me_mgr["id"], "assignee_ids": [op_agc["id"]]},
    )
    assert r.status_code == 403


def test_grading_manager_cannot_assign_warehouse_request(
    client: TestClient,
    admin_headers: dict[str, str],
) -> None:
    create_user(
        client,
        admin_headers,
        email="r2@example.com",
        password="Passw0rd!Y",
        role="requester",
        first_name="Req",
        last_name="Two",
    )
    create_user(
        client,
        admin_headers,
        email="gm@example.com",
        password="Passw0rd!Y",
        role="grading_manager",
        first_name="Gr",
        last_name="Mgr",
    )
    op_wh = create_user(
        client,
        admin_headers,
        email="opwh@example.com",
        password="Passw0rd!Y",
        role="warehouse_operator",
        first_name="Op",
        last_name="Wh",
    )

    req_tok = login(client, "r2@example.com", "Passw0rd!Y")
    mgr_tok = login(client, "gm@example.com", "Passw0rd!Y")

    cr = client.post(
        "/api/requests",
        headers=auth_headers(req_tok),
        json={"item_qty": 1, "fulfillment_site": "warehouse", "priority": "normal"},
    )
    req_id = cr.json()["id"]
    me_mgr = client.get("/api/auth/me", headers=auth_headers(mgr_tok)).json()

    r = client.post(
        f"/api/requests/{req_id}/assign",
        headers=auth_headers(mgr_tok),
        json={"manager_id": me_mgr["id"], "assignee_ids": [op_wh["id"]]},
    )
    assert r.status_code == 403


def test_manager_list_filters_by_fulfillment_site(
    client: TestClient,
    admin_headers: dict[str, str],
) -> None:
    create_user(
        client,
        admin_headers,
        email="r3@example.com",
        password="Passw0rd!Z",
        role="requester",
        first_name="Req",
        last_name="Three",
    )
    create_user(
        client,
        admin_headers,
        email="wm2@example.com",
        password="Passw0rd!Z",
        role="warehouse_manager",
        first_name="Wh",
        last_name="M",
    )
    create_user(
        client,
        admin_headers,
        email="gm2@example.com",
        password="Passw0rd!Z",
        role="grading_manager",
        first_name="Gr",
        last_name="M",
    )

    req_tok = login(client, "r3@example.com", "Passw0rd!Z")
    wm_tok = login(client, "wm2@example.com", "Passw0rd!Z")
    gm_tok = login(client, "gm2@example.com", "Passw0rd!Z")

    wh = client.post(
        "/api/requests",
        headers=auth_headers(req_tok),
        json={"item_qty": 1, "fulfillment_site": "warehouse", "priority": "normal"},
    ).json()["id"]
    agc = client.post(
        "/api/requests",
        headers=auth_headers(req_tok),
        json={"item_qty": 1, "fulfillment_site": "stock_in_agc", "priority": "normal"},
    ).json()["id"]

    wm_list = client.get("/api/requests", headers=auth_headers(wm_tok)).json()
    gm_list = client.get("/api/requests", headers=auth_headers(gm_tok)).json()

    wm_ids = {x["id"] for x in wm_list}
    gm_ids = {x["id"] for x in gm_list}

    assert wh in wm_ids
    assert agc not in wm_ids
    assert agc in gm_ids
    assert wh not in gm_ids


def test_manager_return_to_work_resets_timing_fields(
    client: TestClient,
    admin_headers: dict[str, str],
) -> None:
    create_user(
        client,
        admin_headers,
        email="r4@example.com",
        password="Passw0rd!R",
        role="requester",
        first_name="Req",
        last_name="Four",
    )
    create_user(
        client,
        admin_headers,
        email="wm3@example.com",
        password="Passw0rd!R",
        role="warehouse_manager",
        first_name="Wh",
        last_name="M",
    )
    op = create_user(
        client,
        admin_headers,
        email="op2@example.com",
        password="Passw0rd!R",
        role="warehouse_operator",
        first_name="Op",
        last_name="Wh",
    )

    req_tok = login(client, "r4@example.com", "Passw0rd!R")
    mgr_tok = login(client, "wm3@example.com", "Passw0rd!R")
    op_tok = login(client, "op2@example.com", "Passw0rd!R")

    req_id = client.post(
        "/api/requests",
        headers=auth_headers(req_tok),
        json={"item_qty": 1, "fulfillment_site": "warehouse", "priority": "normal"},
    ).json()["id"]

    me_mgr = client.get("/api/auth/me", headers=auth_headers(mgr_tok)).json()
    client.post(
        f"/api/requests/{req_id}/assign",
        headers=auth_headers(mgr_tok),
        json={"manager_id": me_mgr["id"], "assignee_ids": [op["id"]]},
    )
    client.post(
        f"/api/requests/{req_id}/start",
        headers=auth_headers(op_tok),
        json={"user_id": op["id"]},
    )
    client.post(
        f"/api/requests/{req_id}/finish",
        headers=auth_headers(op_tok),
        json={"user_id": op["id"]},
    )

    rt = client.post(
        f"/api/requests/{req_id}/return-to-work",
        headers=auth_headers(mgr_tok),
        json={"manager_id": me_mgr["id"], "manager_comment": "redo"},
    )
    assert rt.status_code == 200, rt.text
    body = rt.json()
    assert body["status"] == "returned_to_work"
    assert body.get("finished_at") is None
    assert body.get("duration_seconds") is None


def test_pending_cannot_list_users(client: TestClient) -> None:
    r = client.post(
        "/api/auth/register",
        json={
            "first_name": "Pending",
            "last_name": "User",
            "email": "pendinguser@example.com",
            "password": "Passw0rd!P",
        },
    )
    assert r.status_code == 200
    tok = login(client, "pendinguser@example.com", "Passw0rd!P")
    r2 = client.get("/api/users", headers=auth_headers(tok))
    assert r2.status_code == 403
