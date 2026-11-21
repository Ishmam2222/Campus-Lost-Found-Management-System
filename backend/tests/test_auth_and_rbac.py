"""
Automated pytest suite for CSE309 Final Submission (Section 2.4):
- Authentication, JWT creation, token refresh, session revocation, and brute-force lockout
- Token rejection (missing, malformed, tampered, and expired tokens -> 401)
- RBAC and authorization rules (ownership, admin routes, group permissions, admin safety, banned user blocking)
"""

import os
from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402
from security import create_access_token  # noqa: E402


def _fresh_client() -> TestClient:
    return TestClient(app)


def _login_headers(client: TestClient, email: str, password: str) -> dict[str, str]:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    token = res.json()["access_token"]
    client.cookies.clear()
    return {"Authorization": f"Bearer {token}"}


def test_login_and_refresh_flow():
    """Verify valid login returns short-lived JWT (<= 15m) and refresh cookie rotation works."""
    client = _fresh_client()
    res = client.post(
        "/api/auth/login",
        json={"email": "student@campus.edu", "password": "Student123!"},
    )
    assert res.status_code == 200
    body = res.json()
    assert "access_token" in body
    assert body["expires_in"] <= 900  # 15 minutes or less
    assert body["user"]["email"] == "student@campus.edu"

    # Refresh token cookie rotates and issues a new access token
    ref = client.post("/api/auth/refresh")
    assert ref.status_code == 200
    assert "access_token" in ref.json()

    # Logout invalidates the refresh session
    out = client.post("/api/auth/logout")
    assert out.status_code == 200
    ref_after = client.post("/api/auth/refresh")
    assert ref_after.status_code == 401


def test_token_rejection_missing_tampered_and_expired():
    """Verify missing, malformed, tampered, and expired JWT tokens all return 401 Unauthorized."""
    client = _fresh_client()

    # 1. Missing token
    r_missing = client.get("/api/profile")
    assert r_missing.status_code == 401

    # 2. Malformed header
    r_malformed = client.get(
        "/api/profile", headers={"Authorization": "InvalidHeader"}
    )
    assert r_malformed.status_code == 401

    # 3. Tampered signature
    valid_token = create_access_token(1, "admin@campus.edu", "admin")
    tampered_token = valid_token[:-4] + "XXXX"
    r_tampered = client.get(
        "/api/profile", headers={"Authorization": f"Bearer {tampered_token}"}
    )
    assert r_tampered.status_code == 401

    # 4. Expired token (negative expiry)
    expired_token = create_access_token(
        1, "admin@campus.edu", "admin", expires_seconds=-10
    )
    r_expired = client.get(
        "/api/profile", headers={"Authorization": f"Bearer {expired_token}"}
    )
    assert r_expired.status_code == 401


def test_brute_force_login_lockout():
    """Verify 5 consecutive wrong password attempts lock the account with HTTP 429."""
    client = _fresh_client()
    unique_email = "lockout_test@campus.edu"
    client.post(
        "/api/auth/register",
        json={"name": "Lockout User", "email": unique_email, "password": "CorrectPassword1!"},
    )
    client.cookies.clear()

    statuses = []
    for _ in range(5):
        r = client.post(
            "/api/auth/login",
            json={"email": unique_email, "password": "WrongPassword!"},
        )
        statuses.append(r.status_code)

    # 5th failed attempt triggers 429 Too Many Requests lockout
    assert 429 in statuses

    # Even with the right password, account remains locked during lockout window
    r_locked = client.post(
        "/api/auth/login",
        json={"email": unique_email, "password": "CorrectPassword1!"},
    )
    assert r_locked.status_code == 429

    # Admin unban resets lockout
    admin_headers = _login_headers(client, "admin@campus.edu", "Admin123!")
    users = client.get(
        f"/api/admin/users?search={unique_email}", headers=admin_headers
    ).json()["items"]
    if users:
        client.post(
            f"/api/admin/users/{users[0]['id']}/unban", headers=admin_headers
        )


def test_rbac_rule_1_normal_user_denied_admin_endpoints():
    """RBAC Rule 1: Normal user receives 403 Forbidden on admin dashboard and export routes."""
    client = _fresh_client()
    student_headers = _login_headers(client, "student@campus.edu", "Student123!")

    assert client.get("/api/admin/stats", headers=student_headers).status_code == 403
    assert client.get("/api/admin/users", headers=student_headers).status_code == 403
    assert client.get("/api/admin/export/users", headers=student_headers).status_code == 403


def test_rbac_rule_2_ownership_prevents_modifying_other_users_record():
    """RBAC Rule 2: A user can only read, update, or delete their own report; other users receive 403."""
    client = _fresh_client()
    student_headers = _login_headers(client, "student@campus.edu", "Student123!")
    ammar_headers = _login_headers(client, "ammar@campus.edu", "Student123!")

    # Unauthenticated read/list returns 401
    assert client.get("/api/items").status_code == 401

    created = client.post(
        "/api/items",
        json={
            "type": "lost",
            "title": "Student Private Notebook",
            "category": "Books & Stationery",
            "location": "Room 301",
            "description": "Spiral notebook",
            "contact_info": "student@campus.edu",
        },
        headers=student_headers,
    )
    assert created.status_code == 201
    item_id = created.json()["id"]

    # Student sees only their own records in GET /api/items
    student_list = client.get("/api/items", headers=student_headers).json()
    assert all(i["owner_id"] == created.json()["owner_id"] for i in student_list)

    # Ammar (another normal user) cannot READ, UPDATE, or DELETE student's report (403)
    assert (
        client.get(f"/api/items/{item_id}", headers=ammar_headers).status_code
        == 403
    )
    assert (
        client.put(
            f"/api/items/{item_id}",
            json={"title": "Hacked Title"},
            headers=ammar_headers,
        ).status_code
        == 403
    )
    assert (
        client.delete(f"/api/items/{item_id}", headers=ammar_headers).status_code
        == 403
    )

    # Owner CAN read and delete their own report
    assert (
        client.get(f"/api/items/{item_id}", headers=student_headers).status_code
        == 200
    )
    assert (
        client.delete(f"/api/items/{item_id}", headers=student_headers).status_code
        == 200
    )


def test_rbac_rule_3_fine_grained_group_permissions():
    """
    RBAC Rule 3: In the shared group ('Main Library Lost & Found Team'):
    - Owner (student@campus.edu) has full permissions.
    - Ammar (ammar@campus.edu) has can_create, can_edit, can_assign, but CANNOT delete or rename (owner-only).
    - Sajid (sajid@campus.edu) has can_create=True, can_edit=False, can_assign=False.
    """
    client = _fresh_client()
    owner_headers = _login_headers(client, "student@campus.edu", "Student123!")
    ammar_headers = _login_headers(client, "ammar@campus.edu", "Student123!")
    sajid_headers = _login_headers(client, "sajid@campus.edu", "Student123!")

    groups = client.get("/api/groups", headers=owner_headers).json()
    assert len(groups) >= 1
    group_id = groups[0]["id"]

    # Sajid can create a group report
    created = client.post(
        f"/api/groups/{group_id}/items",
        json={
            "type": "found",
            "title": "Umbrella at Library Entrance",
            "category": "Other",
            "location": "Library Lobby",
            "description": "Black folding umbrella",
            "contact_info": "sajid@campus.edu",
        },
        headers=sajid_headers,
    )
    assert created.status_code == 201
    g_item_id = created.json()["id"]

    # Sajid lacks can_edit -> 403 Forbidden
    r_sajid_edit = client.put(
        f"/api/items/{g_item_id}",
        json={"status": "claimed"},
        headers=sajid_headers,
    )
    assert r_sajid_edit.status_code == 403

    # Ammar has can_edit -> 200 OK
    r_ammar_edit = client.put(
        f"/api/items/{g_item_id}",
        json={"status": "claimed"},
        headers=ammar_headers,
    )
    assert r_ammar_edit.status_code == 200

    # Ammar is not owner -> cannot delete group item or rename group (403 Forbidden)
    assert (
        client.delete(f"/api/items/{g_item_id}", headers=ammar_headers).status_code
        == 403
    )
    assert (
        client.patch(
            f"/api/groups/{group_id}",
            json={"name": "Unauthorized Rename"},
            headers=ammar_headers,
        ).status_code
        == 403
    )

    # Owner CAN delete the group item -> 200 OK
    assert (
        client.delete(f"/api/items/{g_item_id}", headers=owner_headers).status_code
        == 200
    )


def test_rbac_rule_4_admin_safety_and_immediate_ban_enforcement():
    """
    RBAC Rule 4:
    - Admin cannot change their own role or ban another admin (400).
    - A banned user is rejected on their very next request (403).
    """
    client = _fresh_client()
    admin_headers = _login_headers(client, "admin@campus.edu", "Admin123!")
    admin_me = client.get("/api/profile", headers=admin_headers).json()

    # Admin cannot demote themselves
    r_self_role = client.patch(
        f"/api/admin/users/{admin_me['id']}/role",
        json={"role": "user"},
        headers=admin_headers,
    )
    assert r_self_role.status_code == 400

    # Admin cannot ban another admin (moderator@campus.edu)
    mod_list = client.get(
        "/api/admin/users?search=moderator@campus.edu", headers=admin_headers
    ).json()["items"]
    assert len(mod_list) >= 1
    r_ban_admin = client.post(
        f"/api/admin/users/{mod_list[0]['id']}/ban",
        json={"reason": "Test"},
        headers=admin_headers,
    )
    assert r_ban_admin.status_code == 400

    # Banned normal user is blocked on their very next request with existing JWT
    sajid_headers = _login_headers(client, "sajid@campus.edu", "Student123!")
    sajid_me = client.get("/api/profile", headers=sajid_headers).json()

    ban_res = client.post(
        f"/api/admin/users/{sajid_me['id']}/ban",
        json={"reason": "Policy test"},
        headers=admin_headers,
    )
    assert ban_res.status_code == 200

    # Next request with existing valid JWT immediately returns 403 Forbidden
    next_req = client.get("/api/profile", headers=sajid_headers)
    assert next_req.status_code == 403

    # Unban restores access
    client.post(
        f"/api/admin/users/{sajid_me['id']}/unban", headers=admin_headers
    )
    assert client.get("/api/profile", headers=sajid_headers).status_code == 200
