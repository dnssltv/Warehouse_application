"""Цикл заявки Stock in AGC (grading_manager + warehouse_operator_agc)."""

from __future__ import annotations

from starlette.testclient import TestClient

from .helpers import auth_headers, create_user, login


def test_agc_happy_path(client: TestClient, admin_headers: dict[str, str]) -> None:
    create_user(
        client,
        admin_headers,
        email="reqagc@example.com",
        password="Passw0rd!Req",
        role="requester",
        first_name="Requester",
        last_name="Two",
    )
    create_user(
        client,
        admin_headers,
        email="gmgr@example.com",
        password="Passw0rd!Mgr",
        role="grading_manager",
        first_name="Grading",
        last_name="Mgr",
    )
    op = create_user(
        client,
        admin_headers,
        email="opagc@example.com",
        password="Passw0rd!Op",
        role="warehouse_operator_agc",
        first_name="Operator",
        last_name="Agc",
    )

    req_tok = login(client, "reqagc@example.com", "Passw0rd!Req")
    mgr_tok = login(client, "gmgr@example.com", "Passw0rd!Mgr")
    op_tok = login(client, "opagc@example.com", "Passw0rd!Op")

    cr = client.post(
        "/api/requests",
        headers=auth_headers(req_tok),
        json={
            "item_qty": 2,
            "movement_number": "AGC-1",
            "comment": "grading batch",
            "priority": "normal",
            "fulfillment_site": "stock_in_agc",
        },
    )
    assert cr.status_code == 200, cr.text
    req_id = cr.json()["id"]
    assert cr.json()["fulfillment_site"] == "stock_in_agc"

    me_mgr = client.get("/api/auth/me", headers=auth_headers(mgr_tok)).json()
    asg = client.post(
        f"/api/requests/{req_id}/assign",
        headers=auth_headers(mgr_tok),
        json={"manager_id": me_mgr["id"], "assignee_ids": [op["id"]]},
    )
    assert asg.status_code == 200, asg.text

    st = client.post(
        f"/api/requests/{req_id}/start",
        headers=auth_headers(op_tok),
        json={"user_id": op["id"]},
    )
    assert st.status_code == 200, st.text

    fin = client.post(
        f"/api/requests/{req_id}/finish",
        headers=auth_headers(op_tok),
        json={"user_id": op["id"]},
    )
    assert fin.status_code == 200, fin.text
    assert fin.json()["status"] == "assembled"

    ap = client.post(
        f"/api/requests/{req_id}/approve",
        headers=auth_headers(mgr_tok),
        json={"manager_id": me_mgr["id"], "manager_comment": "graded OK"},
    )
    assert ap.status_code == 200, ap.text
    assert ap.json()["status"] == "approved"
