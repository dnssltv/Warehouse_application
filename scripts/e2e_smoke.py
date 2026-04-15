import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


API_BASE = "http://localhost/api"
PUBLIC_BASE = "http://localhost"


def api_json(method: str, path: str, token: str | None = None, payload: dict | None = None):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{API_BASE}{path}", data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="ignore")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw


def api_upload(path: str, token: str, file_path: Path):
    boundary = f"----WebKitFormBoundary{int(time.time() * 1000)}"
    file_bytes = file_path.read_bytes()
    filename = file_path.name

    parts = []
    parts.append(f"--{boundary}\r\n".encode("utf-8"))
    parts.append(
        (
            f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
            "Content-Type: text/plain\r\n\r\n"
        ).encode("utf-8")
    )
    parts.append(file_bytes)
    parts.append(f"\r\n--{boundary}--\r\n".encode("utf-8"))
    body = b"".join(parts)

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
    }
    req = urllib.request.Request(f"{API_BASE}{path}", data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read().decode("utf-8")
        return resp.status, (json.loads(raw) if raw else None)


def login(email: str, password: str) -> str:
    code, data = api_json("POST", "/auth/login", payload={"email": email, "password": password})
    if code != 200:
        raise RuntimeError(f"login failed for {email}: {code} {data}")
    return data["access_token"]


def assert_ok(code: int, expected: int, label: str):
    if code != expected:
        raise RuntimeError(f"{label}: expected {expected}, got {code}")


def main():
    stamp = int(time.time())
    initial_password = "Pass1234!"
    updated_password = "Pass1234!NEW"

    admin_email = "d.guselnikov@breezy.kz"
    admin_password = "Ui4ufiyo"
    admin_token = login(admin_email, admin_password)

    users_to_create = [
        {"key": "requester", "role": "requester", "email": f"req{stamp}@breezy.kz"},
        {"key": "wm", "role": "warehouse_manager", "email": f"wm{stamp}@breezy.kz"},
        {"key": "wo", "role": "warehouse_operator", "email": f"wo{stamp}@breezy.kz"},
        {"key": "wo2", "role": "warehouse_operator", "email": f"wo2{stamp}@breezy.kz"},
        {"key": "gm", "role": "grading_manager", "email": f"gm{stamp}@breezy.kz"},
        {"key": "wao", "role": "warehouse_operator_agc", "email": f"wao{stamp}@breezy.kz"},
    ]

    created = {}
    for idx, item in enumerate(users_to_create, start=1):
        first_name = ["Alex", "Boris", "Cody", "Derek", "Evan", "Felix"][idx - 1]
        payload = {
            "first_name": first_name,
            "last_name": "User",
            "email": item["email"],
            "password": initial_password,
            "role": item["role"],
        }
        code, data = api_json("POST", "/users/admin-create", token=admin_token, payload=payload)
        assert_ok(code, 200, f"admin-create {item['key']}")
        created[item["key"]] = data

    # Login with all roles
    tokens = {"admin": admin_token}
    for item in users_to_create:
        tokens[item["key"]] = login(item["email"], initial_password)

    # Create requests by requester
    requester_token = tokens["requester"]
    code, req_wh = api_json(
        "POST",
        "/requests",
        token=requester_token,
        payload={
            "item_qty": 5,
            "movement_number": f"MOVE-WH-{stamp}",
            "comment": "warehouse flow test",
            "priority": "Высокий",
            "fulfillment_site": "warehouse",
        },
    )
    assert_ok(code, 200, "create warehouse request")

    code, req_agc = api_json(
        "POST",
        "/requests",
        token=requester_token,
        payload={
            "item_qty": 2,
            "movement_number": f"MOVE-AGC-{stamp}",
            "comment": "agc flow test",
            "priority": "Срочный",
            "fulfillment_site": "stock_in_agc",
        },
    )
    assert_ok(code, 200, "create agc request")

    # Upload + download attachment
    attachment_file = Path("tmp_e2e_attachment.txt")
    attachment_file.write_text(f"e2e test attachment {stamp}", encoding="utf-8")
    code, req_wh = api_upload(f"/requests/{req_wh['id']}/attachments", requester_token, attachment_file)
    assert_ok(code, 200, "upload attachment")
    attachment_path = req_wh["attachments"][0]
    with urllib.request.urlopen(f"{PUBLIC_BASE}/{attachment_path}", timeout=30) as resp:
        downloaded = resp.read().decode("utf-8")
    if f"{stamp}" not in downloaded:
        raise RuntimeError("attachment download content mismatch")

    # Assign requests
    code, req_wh = api_json(
        "POST",
        f"/requests/{req_wh['id']}/assign",
        token=tokens["wm"],
        payload={
            "manager_id": created["wm"]["id"],
            "assignee_ids": [created["wo"]["id"], created["wo2"]["id"]],
        },
    )
    assert_ok(code, 200, "assign warehouse request")

    code, req_agc = api_json(
        "POST",
        f"/requests/{req_agc['id']}/assign",
        token=tokens["gm"],
        payload={
            "manager_id": created["gm"]["id"],
            "assignee_ids": [created["wao"]["id"]],
        },
    )
    assert_ok(code, 200, "assign agc request")

    # Warehouse worker flow: start -> pause -> resume -> finish
    code, req_wh = api_json(
        "POST",
        f"/requests/{req_wh['id']}/start",
        token=tokens["wo"],
        payload={"user_id": created["wo"]["id"]},
    )
    assert_ok(code, 200, "warehouse start")

    code, req_wh = api_json(
        "POST",
        f"/requests/{req_wh['id']}/pause",
        token=tokens["wo"],
        payload={"user_id": created["wo"]["id"], "pause_comment": "pause for test"},
    )
    assert_ok(code, 200, "warehouse pause")

    code, req_wh = api_json(
        "POST",
        f"/requests/{req_wh['id']}/resume",
        token=tokens["wo"],
        payload={"user_id": created["wo"]["id"]},
    )
    assert_ok(code, 200, "warehouse resume")

    code, req_wh = api_json(
        "POST",
        f"/requests/{req_wh['id']}/finish",
        token=tokens["wo"],
        payload={"user_id": created["wo"]["id"]},
    )
    assert_ok(code, 200, "warehouse finish")

    # AGC worker flow: start -> finish
    code, req_agc = api_json(
        "POST",
        f"/requests/{req_agc['id']}/start",
        token=tokens["wao"],
        payload={"user_id": created["wao"]["id"]},
    )
    assert_ok(code, 200, "agc start")

    code, req_agc = api_json(
        "POST",
        f"/requests/{req_agc['id']}/finish",
        token=tokens["wao"],
        payload={"user_id": created["wao"]["id"]},
    )
    assert_ok(code, 200, "agc finish")

    # Manager approve
    code, req_wh = api_json(
        "POST",
        f"/requests/{req_wh['id']}/approve",
        token=tokens["wm"],
        payload={"manager_id": created["wm"]["id"], "manager_comment": "approved"},
    )
    assert_ok(code, 200, "warehouse approve")

    code, req_agc = api_json(
        "POST",
        f"/requests/{req_agc['id']}/approve",
        token=tokens["gm"],
        payload={"manager_id": created["gm"]["id"], "manager_comment": "approved"},
    )
    assert_ok(code, 200, "agc approve")

    # Requester rates with feedback
    code, req_wh = api_json(
        "POST",
        f"/requests/{req_wh['id']}/rate",
        token=requester_token,
        payload={
            "requester_id": created["requester"]["id"],
            "quality_rating": 5,
            "quality_comment": "excellent",
            "feedback_liked_points": ["Быстрая сборка", "Профессиональная коммуникация"],
            "feedback_issue_points": [],
            "feedback_free_text": "Все отлично",
        },
    )
    assert_ok(code, 200, "rate warehouse")

    code, req_agc = api_json(
        "POST",
        f"/requests/{req_agc['id']}/rate",
        token=requester_token,
        payload={
            "requester_id": created["requester"]["id"],
            "quality_rating": 3,
            "quality_comment": "needs work",
            "feedback_liked_points": ["Хорошее качество сборки"],
            "feedback_issue_points": ["Долго выполнялся заказ", "Не хватило информации по статусу"],
            "feedback_free_text": "Нужно чуть быстрее",
        },
    )
    assert_ok(code, 200, "rate agc")

    # Create account + password change checks
    # 1) Admin password change for wo2
    code, _ = api_json(
        "PATCH",
        f"/users/{created['wo2']['id']}/password",
        token=admin_token,
        payload={"password": updated_password},
    )
    assert_ok(code, 200, "admin password update for wo2")
    _ = login(created["wo2"]["email"], updated_password)

    # 2) Self password change for requester
    code, _ = api_json(
        "POST",
        "/auth/change-password",
        token=requester_token,
        payload={"current_password": initial_password, "new_password": updated_password},
    )
    assert_ok(code, 200, "self password change requester")
    _ = login(created["requester"]["email"], updated_password)

    # Admin delete request endpoint check
    code, _ = api_json("DELETE", f"/requests/{req_agc['id']}", token=admin_token)
    assert_ok(code, 200, "admin delete request")
    code, all_requests = api_json("GET", "/requests", token=admin_token)
    assert_ok(code, 200, "list requests after delete")
    remaining_ids = {r["id"] for r in all_requests}
    if req_agc["id"] in remaining_ids:
        raise RuntimeError("deleted request still present in list")

    summary = {
        "created_users": {k: v["email"] for k, v in created.items()},
        "requests_created": [req_wh["request_number"], req_agc["request_number"]],
        "attachment_download_ok": True,
        "warehouse_flow": "start-pause-resume-finish-approve-rate ok",
        "agc_flow": "start-finish-approve-rate ok",
        "password_checks": "admin reset + self change ok",
        "admin_delete_request": "ok",
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    try:
        attachment_file.unlink(missing_ok=True)
    except Exception:
        pass


if __name__ == "__main__":
    main()
