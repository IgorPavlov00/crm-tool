import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import DateRangePicker from "./DateRangePicker";
import { DateRange, computeRange, rangeQueryParams } from "./dateRange";
import { backendBase, Therapist } from "./adminApi";

type SortKey = "name" | "clients" | "sessions";

const AdminTherapists: React.FC = () => {
  const navigate = useNavigate();
  const [range, setRange] = useState<DateRange>(() => computeRange("current_year"));
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("clients");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    setError("");
    axios
      .get(`${backendBase}/admin/therapists`, { params: rangeQueryParams(range) })
      .then((res) => setTherapists(res.data))
      .catch(() => setError("Greška pri učitavanju terapeuta."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const filtered = useMemo(() => {
    let rows = therapists;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((t) => (t.full_name || t.email).toLowerCase().includes(q));
    }
    const sorted = [...rows];
    if (sort === "name") {
      sorted.sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email));
    } else if (sort === "sessions") {
      sorted.sort((a, b) => b.sessions_in_range - a.sessions_in_range);
    } else {
      sorted.sort((a, b) => b.clients_in_range - a.clients_in_range);
    }
    return sorted;
  }, [therapists, search, sort]);

  const openInvite = () => {
    setShowInvite(true);
    setInviteLoading(true);
    setInviteError("");
    axios
      .get(`${backendBase}/admin/therapists/invite-link`)
      .then((res) =>
        setInviteUrl(`${window.location.origin}/therapist?invite=${encodeURIComponent(res.data.invite_token)}`),
      )
      .catch(() => setInviteError("Nije moguće generisati link za pozivnicu."))
      .finally(() => setInviteLoading(false));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setInviteError("Kopiranje nije uspelo, kopirajte link ručno.");
    }
  };

  const toggleActive = (t: Therapist) => {
    setBusyId(t.user_id);
    axios
      .patch(`${backendBase}/admin/therapists/${t.user_id}`, { active: !t.active })
      .then(() => load())
      .catch((err) => setError(err?.response?.data?.message || "Greška pri izmeni statusa terapeuta."))
      .finally(() => setBusyId(null));
  };

  const toggleAdmin = (t: Therapist) => {
    setBusyId(t.user_id);
    axios
      .patch(`${backendBase}/admin/therapists/${t.user_id}`, { is_admin: !t.is_admin })
      .then(() => load())
      .catch((err) => setError(err?.response?.data?.detail || "Greška pri izmeni admin ovlašćenja."))
      .finally(() => setBusyId(null));
  };

  return (
    <div>
      <div className="mhc-page-header">
        <div>
          <h1 className="mhc-page-title">Terapeuti</h1>
          <p className="mhc-page-sub">Upravljajte članovima tima i pregledajte njihove statistike.</p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {error && <div className="mhc-error">{error}</div>}

      <div className="mhc-toolbar">
        <input
          className="mhc-input mhc-search"
          placeholder="Pretraga terapeuta…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="mhc-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="clients">Sortiraj po klijentima</option>
          <option value="sessions">Sortiraj po sesijama</option>
          <option value="name">Sortiraj po imenu</option>
        </select>
        <button type="button" className="mhc-btn mhc-btn-primary" onClick={openInvite}>
          + Dodaj terapeuta
        </button>
      </div>

      <div className="mhc-panel" style={{ padding: 0 }}>
        <div className="mhc-table-wrap">
          {loading ? (
            <div className="mhc-loading">Učitavanje…</div>
          ) : filtered.length === 0 ? (
            <div className="mhc-empty">Nema terapeuta koji odgovaraju pretrazi.</div>
          ) : (
            <table className="mhc-table">
              <thead>
                <tr>
                  <th>Terapeut</th>
                  <th>Uloga</th>
                  <th>Status</th>
                  <th>Admin</th>
                  <th>Klijenti (period)</th>
                  <th>Sesije (period)</th>
                  <th>Besplatne (period)</th>
                  <th>Ukupno klijenata</th>
                  <th>Ukupno sesija</th>
                  <th>Rang (klijenti)</th>
                  <th>Akcije</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.user_id}>
                    <td>
                      <span className="mhc-table-link" onClick={() => navigate(`/therapist/admin/therapists/${t.user_id}`)}>
                        {t.full_name || t.email}
                      </span>
                    </td>
                    <td>{t.role === "owner" ? "Vlasnik" : "Član"}</td>
                    <td>
                      <span
                        className="mhc-badge"
                        style={{
                          background: t.active ? "#dcfce7" : "#f1f5f9",
                          color: t.active ? "#15803d" : "#64748b",
                        }}
                      >
                        {t.active ? "Aktivan" : "Neaktivan"}
                      </span>
                    </td>
                    <td>
                      <span
                        className="mhc-badge"
                        style={{
                          background: t.is_admin ? "#eef2ff" : "#f1f5f9",
                          color: t.is_admin ? "#4338ca" : "#94a3b8",
                        }}
                      >
                        {t.is_admin ? "Admin" : "Terapeut"}
                      </span>
                    </td>
                    <td>{t.clients_in_range}</td>
                    <td>{t.sessions_in_range}</td>
                    <td>{t.free_sessions_in_range}</td>
                    <td>{t.total_clients}</td>
                    <td>{t.total_sessions}</td>
                    <td>#{t.clients_rank_in_range}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="mhc-btn mhc-btn-sm mhc-btn-secondary"
                        disabled={busyId === t.user_id}
                        onClick={() => toggleActive(t)}
                      >
                        {t.active ? "Deaktiviraj" : "Aktiviraj"}
                      </button>
                      <button
                        type="button"
                        className="mhc-btn mhc-btn-sm mhc-btn-secondary"
                        disabled={busyId === t.user_id}
                        onClick={() => toggleAdmin(t)}
                      >
                        {t.is_admin ? "Oduzmi admin" : "Postavi za admina"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showInvite && (
        <div className="mhc-modal-overlay" onClick={() => setShowInvite(false)}>
          <div className="mhc-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="mhc-modal-title">Pozovite terapeuta</h3>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 14px" }}>
              Pošaljite ovaj link novom terapeutu. Kada se registruje ili
              prijavi preko njega, automatski se priključuje vašem centru.
              Link važi 7 dana.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                readOnly
                className="mhc-input"
                style={{ flex: 1 }}
                value={inviteLoading ? "Generisanje linka…" : inviteUrl}
                onFocus={(e) => e.target.select()}
              />
              <button type="button" className="mhc-btn mhc-btn-primary" disabled={inviteLoading || !inviteUrl} onClick={handleCopy}>
                {copied ? "Kopirano!" : "Kopiraj"}
              </button>
            </div>
            {inviteError && <div className="mhc-error" style={{ marginTop: 12 }}>{inviteError}</div>}
            <div className="mhc-modal-actions">
              <button type="button" className="mhc-btn mhc-btn-secondary" onClick={() => setShowInvite(false)}>
                Zatvori
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTherapists;
