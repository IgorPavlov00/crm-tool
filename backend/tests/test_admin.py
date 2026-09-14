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
import json
from datetime import datetime, timedelta, date

# Must be set BEFORE main_api is imported - both are read at module load time.
os.environ["SUPABASE_JWT_SECRET"] = "test-secret-for-pytest-do-not-use-in-prod"
os.environ.pop("SUPABASE_URL", None)  # keep the JWKS client unconfigured by default; individual tests monkeypatch it in
os.environ.setdefault("DATABASE_URL", "sqlite:///./tests/_test_admin.db")
os.environ["ADMIN_FREE_SESSIONS_COUNT"] = "4"
os.environ["INTERNAL_CRON_SECRET"] = "test-internal-secret-for-pytest"

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
        _recompute_client_free_sessions(db, c1.id)

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
        _recompute_client_free_sessions(db, c3.id)

        # A second, unrelated tenant - proves the admin area is
        # deliberately cross-tenant/global (by explicit product decision),
        # not just correctly isolated to the admin's own tenant.
        other_tenant = Tenant(name="Other Practice", trial_ends_at=datetime.utcnow() + timedelta(days=30))
        db.add(other_tenant)
        db.flush()
        other_therapist = UserProfile(
            supabase_user_id="other-owner-sub", email="other-owner@example.com",
            full_name="Other Practice Owner", role="owner", tenant_id=other_tenant.id,
        )
        db.add(other_therapist)
        db.flush()
        other_client = Klijent(
            tenant_id=other_tenant.id, ime="Zoran", prezime="Zoric", gender="other",
            status="active", therapist_id=other_therapist.id, date_started=date(2024, 1, 1),
        )
        db.add(other_client)
        db.flush()

        db.commit()

        return {
            "tenant_id": tenant.id,
            "owner_id": owner.id,
            "member_id": member.id,
            "practicing_owner_id": practicing_owner.id,
            "c1_id": c1.id,
            "c2_id": c2.id,
            "c3_id": c3.id,
            "other_tenant_id": other_tenant.id,
            "other_therapist_id": other_therapist.id,
            "other_client_id": other_client.id,
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
    # Includes the second, unrelated tenant's therapist+client (see
    # test_admin_sees_data_across_tenants below) - the admin area is
    # deliberately global, not scoped to the admin's own tenant.
    resp = client.get("/admin/dashboard", headers=auth_headers("owner-sub"))
    cards = resp.json()["cards"]
    assert cards["total_therapists"] == 4
    assert cards["total_clients"] == 4
    assert cards["female_clients"] == 2
    assert cards["male_clients"] == 1
    assert cards["other_clients"] == 1
    assert cards["active_clients"] == 3
    assert cards["completed_clients"] == 1
    assert cards["total_sessions"] == 7
    assert cards["free_sessions"] == 6  # 4 free (c1) + 2 free (c3)


def test_admin_sees_data_across_tenants(seeded):
    """The actual point of this change: an admin sees every client and
    therapist in the whole application, not just their own tenant's."""
    clients_resp = client.get("/admin/clients", headers=auth_headers("owner-sub"), params={"page_size": 50})
    client_ids = {c["id"] for c in clients_resp.json()["data"]}
    assert seeded["other_client_id"] in client_ids

    therapists_resp = client.get("/admin/therapists", headers=auth_headers("owner-sub"))
    therapist_ids = {t["user_id"] for t in therapists_resp.json()}
    assert seeded["other_therapist_id"] in therapist_ids

    detail_resp = client.get(f"/admin/clients/{seeded['other_client_id']}", headers=auth_headers("owner-sub"))
    assert detail_resp.status_code == 200
    assert detail_resp.json()["ime"] == "Zoran"


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


def test_besplatno_status_implies_is_free(seeded):
    resp = client.post(
        "/admin/sessions",
        json={"klijent_id": seeded["c1_id"], "pocetak": "2025-08-01T10:00:00", "status": "besplatno"},
        headers=auth_headers("owner-sub"),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "besplatno"
    assert body["is_free"] is True

    # Clean up so later exact-total assertions elsewhere in this file aren't affected.
    client.delete(f"/admin/sessions/{body['id']}", headers=auth_headers("owner-sub"))


def test_session_scheduling_can_set_client_gender(seeded):
    resp = client.post(
        "/admin/sessions",
        json={"klijent_id": seeded["c2_id"], "pocetak": "2025-08-02T10:00:00", "client_gender": "other"},
        headers=auth_headers("owner-sub"),
    )
    assert resp.status_code == 200
    session_id = resp.json()["id"]

    check = client.get(f"/admin/clients/{seeded['c2_id']}", headers=auth_headers("owner-sub"))
    assert check.json()["gender"] == "other"

    # Restore c2's original gender ("male") since test_dashboard_counts_all_time
    # asserts an exact male_clients count elsewhere in this file.
    client.put(
        f"/admin/clients/{seeded['c2_id']}",
        json={
            "ime": "Marko", "prezime": "Markovic", "status": "completed", "gender": "male",
            "therapist_id": seeded["owner_id"], "date_completed": "2025-06-01",
        },
        headers=auth_headers("owner-sub"),
    )
    client.delete(f"/admin/sessions/{session_id}", headers=auth_headers("owner-sub"))


def test_session_without_own_therapist_inherits_from_client(seeded):
    """The actual bug report this fixes: leaderboards showed 0 because
    historical sessions have no therapist_id of their own. A session
    should still count toward its client's assigned therapist."""
    db = SessionLocal()
    try:
        tenant = Tenant(name="Inherit Test Tenant", trial_ends_at=datetime.utcnow() + timedelta(days=30))
        db.add(tenant)
        db.flush()
        therapist = UserProfile(
            supabase_user_id="inherit-owner-sub", email="inherit-owner@example.com",
            full_name="Inherit Owner", role="owner", tenant_id=tenant.id,
        )
        db.add(therapist)
        db.flush()
        c = Klijent(
            tenant_id=tenant.id, ime="Petra", prezime="Petrovic", status="active",
            therapist_id=therapist.id, date_started=date(2025, 5, 1),
        )
        db.add(c)
        db.flush()
        s = Sesija(
            tenant_id=tenant.id, pocetak=datetime(2025, 5, 10), kraj=datetime(2025, 5, 10, 1),
            cena=0, status="zakazano", therapist_id=None,  # no direct assignment
        )
        db.add(s)
        db.flush()
        db.add(SesijaKlijent(tenant_id=tenant.id, klijent_id=c.id, sesija_id=s.id))
        db.commit()
        therapist_id, session_id = therapist.id, s.id
    finally:
        db.close()

    detail = client.get(f"/admin/therapists/{therapist_id}", headers=auth_headers("owner-sub"))
    assert detail.status_code == 200
    body = detail.json()
    assert body["total_sessions"] == 1
    assert session_id in {row["id"] for row in body["recent_sessions"]}

    listing = client.get("/admin/sessions", headers=auth_headers("owner-sub"), params={"therapist_id": therapist_id})
    assert session_id in {row["id"] for row in listing.json()["data"]}


def test_solo_tenant_backfill_assigns_therapist_automatically():
    """Where a tenant has exactly one team member, historical
    clients/sessions with no therapist_id can be safely auto-assigned -
    there's no ambiguity about who it could be."""
    db = SessionLocal()
    try:
        tenant = Tenant(name="Solo Backfill Tenant", trial_ends_at=datetime.utcnow() + timedelta(days=30))
        db.add(tenant)
        db.flush()
        solo_therapist = UserProfile(
            supabase_user_id="solo-backfill-sub", email="solo-backfill@example.com",
            full_name="Solo Therapist", role="owner", tenant_id=tenant.id,
        )
        db.add(solo_therapist)
        db.flush()
        c = Klijent(tenant_id=tenant.id, ime="Nikola", prezime="Nikolic", status="active", date_started=date(2025, 1, 1))
        db.add(c)
        db.flush()
        s = Sesija(
            tenant_id=tenant.id, pocetak=datetime(2025, 1, 5), kraj=datetime(2025, 1, 5, 1),
            cena=0, status="zakazano",
        )
        db.add(s)
        db.flush()
        db.add(SesijaKlijent(tenant_id=tenant.id, klijent_id=c.id, sesija_id=s.id))
        db.commit()
        client_id, session_id, therapist_id = c.id, s.id, solo_therapist.id
        engine = db.get_bind()
    finally:
        db.close()

    main_api.run_light_migrations(engine)

    db2 = SessionLocal()
    try:
        refreshed_client = db2.query(Klijent).filter(Klijent.id == client_id).first()
        refreshed_session = db2.query(Sesija).filter(Sesija.id == session_id).first()
        assert refreshed_client.therapist_id == therapist_id
        assert refreshed_session.therapist_id == therapist_id
    finally:
        db2.close()


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


# --------------------------------------------------------------------------
# Regular (non-admin) booking flow now attributes to the logged-in member
# --------------------------------------------------------------------------

def test_regular_client_and_session_creation_attributes_to_logged_in_member(seeded):
    """A therapist booking through the normal (non-admin) Calendar flow
    should show up as that client's assigned therapist in the admin area -
    this used to stay 'Nedodeljen' forever since the regular endpoints
    never recorded who created anything."""
    headers = {**auth_headers("member-sub"), "X-Tenant-ID": str(seeded["tenant_id"])}

    client_resp = client.post("/klijent/", json={"ime": "Regular", "prezime": "Client"}, headers=headers)
    assert client_resp.status_code == 200
    new_client_id = client_resp.json()["id"]
    assert client_resp.json()["therapist_id"] == seeded["member_id"]

    session_resp = client.post(
        "/sesija/",
        json={
            "cena": 0, "status": "besplatno",
            "pocetak": "2025-09-01T10:00:00", "kraj": "2025-09-01T11:00:00",
            "klijent_id": new_client_id,
        },
        headers=headers,
    )
    assert session_resp.status_code == 200
    assert session_resp.json()["therapist_id"] == seeded["member_id"]
    assert session_resp.json()["is_free"] is True

    # cleanup so shared fixture totals stay stable for other tests
    client.delete(f"/sesija/{session_resp.json()['id']}/", headers=headers)
    client.delete(f"/klijent/{new_client_id}/", headers=headers)


def test_regular_creation_without_token_leaves_therapist_unassigned(seeded):
    """No Authorization header at all (e.g. an older cached frontend
    build) must keep working exactly as before - just without attribution."""
    headers = {"X-Tenant-ID": str(seeded["tenant_id"])}
    resp = client.post("/klijent/", json={"ime": "Anon", "prezime": "Client"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["therapist_id"] is None
    client.delete(f"/klijent/{resp.json()['id']}/", headers=headers)


# --------------------------------------------------------------------------
# Session reminders
# --------------------------------------------------------------------------

def test_reminder_endpoint_requires_correct_secret(seeded):
    assert client.post("/internal/send-reminders").status_code == 401
    assert client.post(
        "/internal/send-reminders", headers={"X-Internal-Secret": "wrong-secret"}
    ).status_code == 401


def test_reminder_dry_run_reports_without_sending_or_marking(seeded):
    """Proves the reminder pipeline finds the right sessions without
    risking an actual email send to a real client - safe to call
    against production to verify config (e.g. resend_api_key_configured)."""
    client_resp = client.post(
        "/admin/clients",
        json={"ime": "Reminder", "prezime": "Test", "email": "reminder-test@example.com"},
        headers=auth_headers("owner-sub"),
    )
    assert client_resp.status_code == 200
    reminder_client_id = client_resp.json()["id"]

    tomorrow = datetime.utcnow() + timedelta(hours=24)
    session_resp = client.post(
        "/admin/sessions",
        json={"klijent_id": reminder_client_id, "pocetak": tomorrow.isoformat(), "status": "zakazano"},
        headers=auth_headers("owner-sub"),
    )
    assert session_resp.status_code == 200
    session_id = session_resp.json()["id"]

    resp = client.post(
        "/internal/send-reminders",
        params={"dry_run": "true"},
        headers={"X-Internal-Secret": "test-internal-secret-for-pytest"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["dry_run"] is True
    assert body["resend_api_key_configured"] is False  # RESEND_API_KEY isn't set in tests
    matching = [s for s in body["would_send"] if s["sesija_id"] == session_id]
    assert len(matching) == 1
    assert matching[0]["has_email"] is True

    # Confirm dry_run really didn't mark it as reminded (a real run would).
    db = SessionLocal()
    try:
        refreshed = db.query(Sesija).filter(Sesija.id == session_id).first()
        assert refreshed.reminder_sent is False
    finally:
        db.close()

    client.delete(f"/admin/sessions/{session_id}", headers=auth_headers("owner-sub"))


# --------------------------------------------------------------------------
# Public "Find a Therapist" booking now sends an admin intake request
# instead of auto-booking a session with an auto-matched therapist
# --------------------------------------------------------------------------

def test_public_booking_sends_intake_email_without_auto_creating_session(monkeypatch):
    db = SessionLocal()
    try:
        tenant = Tenant(
            name="Public Intake Tenant",
            trial_ends_at=datetime.utcnow() + timedelta(days=30),
            working_hours=json.dumps(
                {str(i): {"active": True, "start": "09:00", "end": "17:00"} for i in range(7)}
            ),
        )
        db.add(tenant)
        db.commit()
        tenant_id = tenant.id
    finally:
        db.close()

    avail = client.get(f"/public/therapists/{tenant_id}/availability")
    assert avail.status_code == 200
    slots = avail.json()["slots"]
    assert len(slots) > 0
    slot = slots[0]

    sent_emails = []
    monkeypatch.setattr(main_api.resend.Emails, "send", lambda payload: sent_emails.append(payload))

    resp = client.post(
        f"/public/therapists/{tenant_id}/book",
        json={
            "ime": "Public", "prezime": "Klijent", "email": "public-intake@example.com",
            "telefon": None, "napomena": "Trazim pomoc", "pocetak": slot["start"], "kraj": slot["end"],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "sesija_id" not in body
    assert body["tenant_name"] == "Public Intake Tenant"

    db2 = SessionLocal()
    try:
        new_client = db2.query(Klijent).filter(
            Klijent.tenant_id == tenant_id, Klijent.email == "public-intake@example.com"
        ).first()
        assert new_client is not None
        assert new_client.therapist_id is None  # no auto-assignment anymore
        assert db2.query(Sesija).filter(Sesija.tenant_id == tenant_id).count() == 0  # no auto-booked session
    finally:
        db2.close()

    assert len(sent_emails) == 1
    assert sent_emails[0]["to"] == [main_api.PUBLIC_INTAKE_NOTIFY_EMAIL]


# --------------------------------------------------------------------------
# Simplified public intake (no more therapist matching/self-booking)
# --------------------------------------------------------------------------

def test_public_intake_request_creates_unassigned_client_and_emails_admin(monkeypatch):
    sent_emails = []
    monkeypatch.setattr(main_api.resend.Emails, "send", lambda payload: sent_emails.append(payload))

    resp = client.post(
        "/public/intake-request",
        json={
            "ime": "Nova", "prezime": "Osoba", "email": "nova-osoba@example.com",
            "telefon": "0601234567", "tags": ["Anksioznost", "Nesanica"],
            "opis": "Ne mogu da spavam poslednjih nedelju dana.",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["klijent_ime"] == "Nova Osoba"

    db = SessionLocal()
    try:
        tenant = db.query(Tenant).filter(Tenant.name == main_api.PUBLIC_INTAKE_TENANT_NAME).first()
        assert tenant is not None
        new_client = db.query(Klijent).filter(
            Klijent.tenant_id == tenant.id, Klijent.email == "nova-osoba@example.com"
        ).first()
        assert new_client is not None
        assert new_client.therapist_id is None  # admin assigns manually
    finally:
        db.close()

    assert len(sent_emails) == 1
    assert sent_emails[0]["to"] == [main_api.PUBLIC_INTAKE_NOTIFY_EMAIL]
    assert "Anksioznost" in sent_emails[0]["html"]
    assert "Ne mogu da spavam" in sent_emails[0]["html"]


def test_public_intake_request_requires_contact_info_and_content(monkeypatch):
    monkeypatch.setattr(main_api.resend.Emails, "send", lambda payload: None)

    missing_email = client.post(
        "/public/intake-request",
        json={"ime": "A", "prezime": "B", "email": "", "tags": ["Anksioznost"]},
    )
    assert missing_email.status_code == 400

    no_tags_no_opis = client.post(
        "/public/intake-request",
        json={"ime": "A", "prezime": "B", "email": "a@example.com", "tags": []},
    )
    assert no_tags_no_opis.status_code == 400
