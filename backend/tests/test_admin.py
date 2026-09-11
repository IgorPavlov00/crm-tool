"""
Tests for the admin area (Mental Health Center management).

Covers the requirements called out in the spec:
- ADMIN can access admin endpoints; NON-ADMIN gets 403; anonymous gets 401.
- Dashboard calculations (totals, gender, active/completed) are correct.
- Date-range filtering changes the numbers.
- The first-N-sessions-free calculation is correct.
- Therapist leaderboards are correct, including tie handling.
- Attendance calculations are correct.

Run with:  cd backend && pytest
"""
import os
import sys
from datetime import datetime, timedelta, date

# Must be set BEFORE main_api is imported - both are read at module load time.
os.environ["SUPABASE_JWT_SECRET"] = "test-secret-for-pytest-do-not-use-in-prod"
os.environ.pop("SUPABASE_URL", None)  # keep the JWKS client unconfigured by default; individual tests monkeypatch it in
os.environ.setdefault("DATABASE_URL", "sqlite:///./tests/_test_admin.db")
os.environ["ADMIN_FREE_SESSIONS_COUNT"] = "4"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Start every run from a clean database file so tests are deterministic.
_db_path = os.environ["DATABASE_URL"].replace("sqlite:///./", "")
if os.path.exists(_db_path):
    os.remove(_db_path)

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

import main_api
from main_api import app, SessionLocal, _rank_map, _recompute_client_free_sessions
from sql_alchemy import Tenant, UserProfile, Klijent, Sesija, SesijaKlijent

client = TestClient(app)
SECRET = os.environ["SUPABASE_JWT_SECRET"]


def make_token(sub: str) -> str:
    payload = {
        "sub": sub,
        "aud": "authenticated",
        "role": "authenticated",
        "exp": datetime.utcnow() + timedelta(hours=1),
    }
    return jwt.encode(payload, SECRET, algorithm="HS256")


def auth_headers(sub: str) -> dict:
    return {"Authorization": f"Bearer {make_token(sub)}"}


@pytest.fixture(scope="module")
def seeded():
    db = SessionLocal()
    try:
        tenant = Tenant(name="Test Center", trial_ends_at=datetime.utcnow() + timedelta(days=30))
        db.add(tenant)
        db.flush()

        owner = UserProfile(
            supabase_user_id="owner-sub", email="owner@example.com",
            full_name="Owner Person", role="owner", is_admin=True, tenant_id=tenant.id,
        )
        member = UserProfile(
            supabase_user_id="member-sub", email="member@example.com",
            full_name="Member Person", role="member", tenant_id=tenant.id,
        )
        # A tenant "owner" who is NOT an admin (e.g. a practicing
        # psychotherapist who happens to hold the owner role) - proves
        # is_admin, not role, is what gates the admin area.
        practicing_owner = UserProfile(
            supabase_user_id="owner-no-admin-sub", email="practicing-owner@example.com",
            full_name="Practicing Owner", role="owner", is_admin=False, tenant_id=tenant.id,
        )
        db.add_all([owner, member, practicing_owner])
        db.flush()

        c1 = Klijent(
            tenant_id=tenant.id, ime="Ana", prezime="Anic", gender="female",
            status="active", therapist_id=owner.id, date_started=date(2025, 1, 10),
        )
        c2 = Klijent(
            tenant_id=tenant.id, ime="Marko", prezime="Markovic", gender="male",
            status="completed", therapist_id=owner.id, date_started=date(2025, 2, 1),
            date_completed=date(2025, 6, 1),
        )
        c3 = Klijent(
            tenant_id=tenant.id, ime="Jovana", prezime="Jovanovic", gender="female",
            status="active", therapist_id=member.id, date_started=date(2026, 1, 5),
        )
        db.add_all([c1, c2, c3])
        db.flush()

        # c1: 5 individual sessions in 2025 -> first 4 should be free, 5th regular
        for i in range(5):
            start = datetime(2025, 1, 10) + timedelta(days=7 * i)
            s = Sesija(
                tenant_id=tenant.id, pocetak=start, kraj=start + timedelta(hours=1),
                cena=0, status="zakazano", therapist_id=owner.id,
            )
            db.add(s)
            db.flush()
            db.add(SesijaKlijent(tenant_id=tenant.id, klijent_id=c1.id, sesija_id=s.id))
        db.flush()
        _recompute_client_free_sessions(db, tenant.id, c1.id)

        # c3: 2 sessions in 2026 -> both free (under the free-session cutoff)
        for i in range(2):
            start = datetime(2026, 1, 5) + timedelta(days=7 * i)
            s = Sesija(
                tenant_id=tenant.id, pocetak=start, kraj=start + timedelta(hours=1),
                cena=0, status="zakazano", therapist_id=member.id,
            )
            db.add(s)
            db.flush()
            db.add(SesijaKlijent(tenant_id=tenant.id, klijent_id=c3.id, sesija_id=s.id))
        db.flush()
        _recompute_client_free_sessions(db, tenant.id, c3.id)

        db.commit()

        return {
            "tenant_id": tenant.id,
            "owner_id": owner.id,
            "member_id": member.id,
            "practicing_owner_id": practicing_owner.id,
            "c1_id": c1.id,
            "c2_id": c2.id,
            "c3_id": c3.id,
        }
    finally:
        db.close()


# --------------------------------------------------------------------------
# Authorization
# --------------------------------------------------------------------------

def test_anonymous_request_is_rejected(seeded):
    resp = client.get("/admin/dashboard")
    assert resp.status_code == 401


def test_invalid_token_is_rejected(seeded):
    resp = client.get("/admin/dashboard", headers={"Authorization": "Bearer not-a-real-token"})
    assert resp.status_code == 401


def test_non_admin_member_gets_403(seeded):
    resp = client.get("/admin/dashboard", headers=auth_headers("member-sub"))
    assert resp.status_code == 403


def test_non_admin_cannot_mutate_clients(seeded):
    resp = client.post(
        "/admin/clients",
        json={"ime": "Test", "prezime": "Test"},
        headers=auth_headers("member-sub"),
    )
    assert resp.status_code == 403


def test_admin_owner_can_access(seeded):
    resp = client.get("/admin/dashboard", headers=auth_headers("owner-sub"))
    assert resp.status_code == 200


def test_unknown_account_is_rejected(seeded):
    resp = client.get("/admin/dashboard", headers=auth_headers("nobody-sub"))
    assert resp.status_code == 401


def test_es256_jwks_token_is_verified(seeded, monkeypatch):
    """Modern Supabase projects sign session tokens with an asymmetric
    ES256 key published via JWKS, not the legacy HS256 shared secret.
    This proves that path actually works end-to-end (signature,
    audience, issuer), not just that the HS256 fallback used elsewhere
    in this file happens to succeed."""
    private_key = ec.generate_private_key(ec.SECP256R1())
    issuer = "https://example.supabase.co/auth/v1"

    class FakeSigningKey:
        key = private_key.public_key()

    class FakeJWKSClient:
        def get_signing_key_from_jwt(self, token):
            return FakeSigningKey()

    monkeypatch.setattr(main_api, "_jwks_client", FakeJWKSClient())
    monkeypatch.setattr(main_api, "SUPABASE_ISSUER", issuer)

    token = jwt.encode(
        {
            "sub": "owner-sub",
            "aud": "authenticated",
            "iss": issuer,
            "exp": datetime.utcnow() + timedelta(hours=1),
        },
        private_key,
        algorithm="ES256",
    )

    resp = client.get("/admin/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


def test_es256_token_with_wrong_signature_is_rejected(seeded, monkeypatch):
    signing_key_pair = ec.generate_private_key(ec.SECP256R1())
    attacker_key_pair = ec.generate_private_key(ec.SECP256R1())
    issuer = "https://example.supabase.co/auth/v1"

    class FakeSigningKey:
        key = signing_key_pair.public_key()  # server only trusts this key

    class FakeJWKSClient:
        def get_signing_key_from_jwt(self, token):
            return FakeSigningKey()

    monkeypatch.setattr(main_api, "_jwks_client", FakeJWKSClient())
    monkeypatch.setattr(main_api, "SUPABASE_ISSUER", issuer)

    # Signed with a different key than the one the "JWKS" serves.
    forged_token = jwt.encode(
        {"sub": "owner-sub", "aud": "authenticated", "iss": issuer,
         "exp": datetime.utcnow() + timedelta(hours=1)},
        attacker_key_pair,
        algorithm="ES256",
    )

    resp = client.get("/admin/dashboard", headers={"Authorization": f"Bearer {forged_token}"})
    assert resp.status_code == 401


def test_owner_role_without_is_admin_gets_403(seeded):
    """The exact scenario admin access must guard against: a tenant
    'owner' who is a practicing psychotherapist, not the center admin."""
    resp = client.get("/admin/dashboard", headers=auth_headers("owner-no-admin-sub"))
    assert resp.status_code == 403


def test_is_admin_is_independent_of_role(seeded):
    resp = client.get("/admin/therapists", headers=auth_headers("owner-sub"))
    rows = {r["user_id"]: r for r in resp.json()}
    assert rows[seeded["owner_id"]]["is_admin"] is True
    assert rows[seeded["practicing_owner_id"]]["role"] == "owner"
    assert rows[seeded["practicing_owner_id"]]["is_admin"] is False
    assert rows[seeded["member_id"]]["is_admin"] is False


def test_admin_can_promote_and_demote_admin_status(seeded):
    target_id = seeded["member_id"]

    promote = client.patch(
        f"/admin/therapists/{target_id}", json={"is_admin": True}, headers=auth_headers("owner-sub"),
    )
    assert promote.status_code == 200
    assert promote.json()["is_admin"] is True
    assert client.get("/admin/dashboard", headers=auth_headers("member-sub")).status_code == 200

    demote = client.patch(
        f"/admin/therapists/{target_id}", json={"is_admin": False}, headers=auth_headers("owner-sub"),
    )
    assert demote.status_code == 200
    assert demote.json()["is_admin"] is False
    assert client.get("/admin/dashboard", headers=auth_headers("member-sub")).status_code == 403


def test_admin_cannot_revoke_own_admin_status(seeded):
    resp = client.patch(
        f"/admin/therapists/{seeded['owner_id']}", json={"is_admin": False}, headers=auth_headers("owner-sub"),
    )
    assert resp.status_code == 400


# --------------------------------------------------------------------------
# Dashboard calculations
# --------------------------------------------------------------------------

def test_dashboard_counts_all_time(seeded):
    resp = client.get("/admin/dashboard", headers=auth_headers("owner-sub"))
    cards = resp.json()["cards"]
    assert cards["total_therapists"] == 3
    assert cards["total_clients"] == 3
    assert cards["female_clients"] == 2
    assert cards["male_clients"] == 1
    assert cards["active_clients"] == 2
    assert cards["completed_clients"] == 1
    assert cards["total_sessions"] == 7
    assert cards["free_sessions"] == 6  # 4 free (c1) + 2 free (c3)


def test_dashboard_date_range_filter_changes_numbers(seeded):
    resp = client.get(
        "/admin/dashboard",
        params={"start_date": "2026-01-01", "end_date": "2026-12-31"},
        headers=auth_headers("owner-sub"),
    )
    cards = resp.json()["cards"]
    assert cards["total_clients"] == 1  # only c3 started in 2026
    assert cards["total_sessions"] == 2
    assert cards["free_sessions"] == 2


def test_dashboard_previous_year_filter(seeded):
    resp = client.get(
        "/admin/dashboard",
        params={"start_date": "2025-01-01", "end_date": "2025-12-31"},
        headers=auth_headers("owner-sub"),
    )
    cards = resp.json()["cards"]
    assert cards["total_clients"] == 2  # c1, c2
    assert cards["completed_clients"] == 1
    assert cards["total_sessions"] == 5


# --------------------------------------------------------------------------
# First-N-sessions-free calculation
# --------------------------------------------------------------------------

def test_first_four_sessions_free_then_regular(seeded):
    resp = client.get(f"/admin/clients/{seeded['c1_id']}", headers=auth_headers("owner-sub"))
    assert resp.status_code == 200
    sessions = sorted(resp.json()["sessions"], key=lambda s: s["session_number"])
    assert [s["session_number"] for s in sessions] == [1, 2, 3, 4, 5]
    assert [s["is_free"] for s in sessions] == [True, True, True, True, False]


def test_free_sessions_count_is_configurable():
    from main_api import FREE_SESSIONS_COUNT
    assert FREE_SESSIONS_COUNT == 4  # set via ADMIN_FREE_SESSIONS_COUNT above


# --------------------------------------------------------------------------
# Completed clients / status handling
# --------------------------------------------------------------------------

def test_completed_client_has_date_completed(seeded):
    resp = client.get(f"/admin/clients/{seeded['c2_id']}", headers=auth_headers("owner-sub"))
    body = resp.json()
    assert body["status"] == "completed"
    assert body["date_completed"] == "2025-06-01"


def test_archiving_client_logs_audit_action(seeded):
    resp = client.put(
        f"/admin/clients/{seeded['c2_id']}",
        json={
            "ime": "Marko", "prezime": "Markovic", "status": "archived",
            "gender": "male", "therapist_id": seeded["owner_id"],
        },
        headers=auth_headers("owner-sub"),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "archived"

    log = client.get("/admin/audit-log", headers=auth_headers("owner-sub")).json()
    assert any(e["action"] == "CLIENT_ARCHIVED" for e in log)

    # restore state for other tests in this module
    client.put(
        f"/admin/clients/{seeded['c2_id']}",
        json={
            "ime": "Marko", "prezime": "Markovic", "status": "completed",
            "gender": "male", "therapist_id": seeded["owner_id"],
            "date_completed": "2025-06-01",
        },
        headers=auth_headers("owner-sub"),
    )


# --------------------------------------------------------------------------
# Therapist leaderboards + tie handling
# --------------------------------------------------------------------------

def test_leaderboard_ranking(seeded):
    resp = client.get("/admin/leaderboard", headers=auth_headers("owner-sub"))
    rows = {r["user_id"]: r for r in resp.json()["most_clients"]}
    assert rows[seeded["owner_id"]]["count"] == 2
    assert rows[seeded["owner_id"]]["rank"] == 1
    assert rows[seeded["member_id"]]["count"] == 1
    assert rows[seeded["member_id"]]["rank"] == 2


def test_rank_map_handles_ties():
    ranks = _rank_map([(1, 5), (2, 5), (3, 3)])
    assert ranks[1] == 1
    assert ranks[2] == 1  # tied with #1, same rank
    assert ranks[3] == 3  # next distinct rank skips 2 (competition ranking)


# --------------------------------------------------------------------------
# Team attendance
# --------------------------------------------------------------------------

def test_attendance_matrix_and_percentage(seeded):
    create = client.post(
        "/admin/team-attendance/meetings",
        json={"date": "2026-03-18", "type": "team_meeting"},
        headers=auth_headers("owner-sub"),
    )
    assert create.status_code == 200
    meeting_id = create.json()["id"]

    mark = client.put(
        f"/admin/team-attendance/meetings/{meeting_id}/attendance",
        json={"records": [
            {"user_profile_id": seeded["owner_id"], "status": "present"},
            {"user_profile_id": seeded["member_id"], "status": "absent"},
        ]},
        headers=auth_headers("owner-sub"),
    )
    assert mark.status_code == 200

    matrix = client.get("/admin/team-attendance/matrix", headers=auth_headers("owner-sub")).json()
    owner_stats = matrix["stats"][str(seeded["owner_id"])]
    member_stats = matrix["stats"][str(seeded["member_id"])]
    assert owner_stats["attended"] == 1
    assert owner_stats["meetings_held"] == 1
    assert owner_stats["percentage"] == 100.0
    assert member_stats["absent"] == 1
    assert member_stats["percentage"] == 0.0


def test_invalid_attendance_status_rejected(seeded):
    create = client.post(
        "/admin/team-attendance/meetings",
        json={"date": "2026-03-19"},
        headers=auth_headers("owner-sub"),
    )
    meeting_id = create.json()["id"]
    resp = client.put(
        f"/admin/team-attendance/meetings/{meeting_id}/attendance",
        json={"records": [{"user_profile_id": seeded["owner_id"], "status": "maybe"}]},
        headers=auth_headers("owner-sub"),
    )
    assert resp.status_code == 400
