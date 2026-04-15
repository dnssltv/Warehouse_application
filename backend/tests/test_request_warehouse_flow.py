"""Полный цикл заявки на складе (warehouse)."""

from __future__ import annotations

from starlette.testclient import TestClient

from .helpers import auth_headers, create_user, login


def test_warehouse_happy_path(client: TestClient, admin_headers: dict[str, str]) -> None:
    create_user(
        client,
        admin_headers,
        email="req@example.com",
        password="Passw0rd!Req",
        role="requester",
        first_name="Requester",
        last_name="One",
    )
    create_user(
        client,
        admin_headers,
        email="mgr@example.com",
        password="Passw0rd!Mgr",
        role="warehouse_manager",
        first_name="Manager",
        last_name="Wh",
    )
    op = create_user(
        client,
        admin_headers,
        email="op@example.com",
        password="Passw0rd!Op",
        role="warehouse_operator",
        first_name="Operator",
        last_name="Wh",
    )

    req_tok = login(client, "req@example.com", "Passw0rd!Req")
    mgr_tok = login(client, "mgr@example.com", "Passw0rd!Mgr")
    op_tok = login(client, "op@example.com", "Passw0rd!Op")

    cr = client.post(
        "/api/requests",
        headers=auth_headers(req_tok),
        json={
            "item_qty": 3,
            "movement_number": "MV-1",
            "comment": "test order",
            "priority": "normal",
            "fulfillment_site": "warehouse",
        },
    )
    assert cr.status_code == 200, cr.text
    req_id = cr.json()["id"]
    assert cr.json()["status"] == "new"
    assert cr.json()["fulfillment_site"] == "warehouse"

    op_list_before = client.get("/api/requests", headers=auth_headers(op_tok))
    assert op_list_before.status_code == 200
    assert op_list_before.json() == []

    mgr_list = client.get("/api/requests", headers=auth_headers(mgr_tok))
    assert mgr_list.status_code == 200
    assert any(r["id"] == req_id for r in mgr_list.json())

    me_mgr = client.get("/api/auth/me", headers=auth_headers(mgr_tok)).json()
    asg = client.post(
        f"/api/requests/{req_id}/assign",
        headers=auth_headers(mgr_tok),
        json={"manager_id": me_mgr["id"], "assignee_ids": [op["id"]]},
    )
    assert asg.status_code == 200, asg.text
    assert asg.json()["status"] == "assigned"

    op_list_after = client.get("/api/requests", headers=auth_headers(op_tok))
    assert len(op_list_after.json()) == 1

    st = client.post(
        f"/api/requests/{req_id}/start",
        headers=auth_headers(op_tok),
        json={"user_id": op["id"]},
    )
    assert st.status_code == 200, st.text
    assert st.json()["status"] == "in_progress"

    ps = client.post(
        f"/api/requests/{req_id}/pause",
        headers=auth_headers(op_tok),
        json={"user_id": op["id"], "pause_comment": "short break"},
    )
    assert ps.status_code == 200, ps.text
    assert ps.json()["status"] == "paused"
    assert "short break" in (ps.json().get("pause_comment") or "")

    rs = client.post(
        f"/api/requests/{req_id}/resume",
        headers=auth_headers(op_tok),
        json={"user_id": op["id"]},
    )
    assert rs.status_code == 200
    assert rs.json()["status"] == "in_progress"

    fin = client.post(
        f"/api/requests/{req_id}/finish",
        headers=auth_headers(op_tok),
        json={"user_id": op["id"]},
    )
    assert fin.status_code == 200, fin.text
    assert fin.json()["status"] == "assembled"
    assert fin.json().get("duration_seconds") is not None

    ap = client.post(
        f"/api/requests/{req_id}/approve",
        headers=auth_headers(mgr_tok),
        json={"manager_id": me_mgr["id"], "manager_comment": "OK"},
    )
    assert ap.status_code == 200, ap.text
    assert ap.json()["status"] == "approved"

    me_req = client.get("/api/auth/me", headers=auth_headers(req_tok)).json()
    rt = client.post(
        f"/api/requests/{req_id}/rate",
        headers=auth_headers(req_tok),
        json={
            "requester_id": me_req["id"],
            "quality_rating": 5,
            "quality_comment": "fine",
        },
    )
    assert rt.status_code == 200, rt.text
    assert rt.json()["status"] == "rated"
    assert rt.json()["quality_rating"] == 5
