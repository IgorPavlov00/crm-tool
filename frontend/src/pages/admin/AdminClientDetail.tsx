import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import {
  backendBase,
  Client,
  SessionRow,
  Therapist,
  GENDER_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  formatDate,
  formatDateTime,
} from "./adminApi";

interface ClientDetailResponse extends Client {
  session_count: number;
  sessions: SessionRow[];
}

const AdminClientDetail: React.FC = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<ClientDetailResponse | null>(null);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionDate, setSessionDate] = useState("");
  const [sessionTherapist, setSessionTherapist] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [savingSession, setSavingSession] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    axios
      .get(`${backendBase}/admin/clients/${clientId}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err?.response?.status === 404 ? "Klijent nije pronađen." : "Greška pri učitavanju."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    axios.get(`${backendBase}/admin/therapists`).then((res) => setTherapists(res.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const openAddSession = () => {
    setSessionDate("");
    setSessionTherapist(data?.therapist_id ? String(data.therapist_id) : "");
    setSessionError("");
    setShowSessionModal(true);
  };

  const handleAddSession = () => {
    if (!sessionDate) {
      setSessionError("Datum i vreme sesije su obavezni.");
      return;
    }
    setSavingSession(true);
    setSessionError("");
    axios
      .post(`${backendBase}/admin/sessions`, {
        klijent_id: Number(clientId),
        therapist_id: sessionTherapist ? Number(sessionTherapist) : null,
        pocetak: sessionDate,
      })
      .then(() => {
        setShowSessionModal(false);
        load();
      })
      .catch((err) => setSessionError(err?.response?.data?.detail || "Greška pri kreiranju sesije."))
      .finally(() => setSavingSession(false));
  };

  const handleDeleteSession = (sessionId: number) => {
    axios
      .delete(`${backendBase}/admin/sessions/${sessionId}`)
      .then(() => load())
      .catch(() => setError("Greška pri brisanju sesije."));
  };

  if (loading) return <div className="mhc-loading">Učitavanje…</div>;
  if (error && !data) return <div className="mhc-error">{error}</div>;
  if (!data) return null;

  return (
    <div>
      <button type="button" className="mhc-btn mhc-btn-secondary mhc-btn-sm" onClick={() => navigate("/therapist/admin/clients")} style={{ marginBottom: 16 }}>
        ← Nazad na klijente
      </button>

      <div className="mhc-page-header">
        <div>
          <h1 className="mhc-page-title">
            {data.ime} {data.prezime}
          </h1>
          <p className="mhc-page-sub">
            {data.gender ? GENDER_LABELS[data.gender] : "Pol nepoznat"} · Terapeut: {data.therapist_name || "Nedodeljen"}
          </p>
        </div>
        <span className="mhc-badge" style={STATUS_COLORS[data.status]}>
          {STATUS_LABELS[data.status] || data.status}
        </span>
      </div>

      {error && <div className="mhc-error">{error}</div>}

      <div className="mhc-cards-grid">
        <div className="mhc-card">
          <div className="mhc-card-label">Ukupno sesija</div>
          <div className="mhc-card-value">{data.session_count}</div>
        </div>
        <div className="mhc-card">
          <div className="mhc-card-label">Datum početka</div>
          <div className="mhc-card-value" style={{ fontSize: 18 }}>{formatDate(data.date_started)}</div>
        </div>
        <div className="mhc-card">
          <div className="mhc-card-label">Datum završetka</div>
          <div className="mhc-card-value" style={{ fontSize: 18 }}>{formatDate(data.date_completed)}</div>
        </div>
        <div className="mhc-card">
          <div className="mhc-card-label">Kontakt</div>
          <div style={{ fontSize: 13, color: "#334155" }}>
            {data.email || "—"}
            <br />
            {data.broj_telefona || "—"}
          </div>
        </div>
      </div>

      <div className="mhc-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 className="mhc-panel-title" style={{ margin: 0 }}>
            Hronologija sesija
          </h3>
          <button type="button" className="mhc-btn mhc-btn-primary mhc-btn-sm" onClick={openAddSession}>
            + Nova sesija
          </button>
        </div>

        {data.sessions.length === 0 ? (
          <div className="mhc-empty">Još uvek nema zabeleženih sesija.</div>
        ) : (
          <div className="mhc-table-wrap">
            <table className="mhc-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Datum</th>
                  <th>Terapeut</th>
                  <th>Status</th>
                  <th>Naplata</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((s) => (
                  <tr key={s.id}>
                    <td>{s.session_number ?? "—"}</td>
                    <td>{formatDateTime(s.pocetak)}</td>
                    <td>{s.therapist_name || "—"}</td>
                    <td>{s.status === "otkazano" ? "Otkazano" : "Zakazano"}</td>
                    <td>
                      {s.is_free === null ? (
                        "—"
                      ) : (
                        <span
                          className="mhc-badge"
                          style={s.is_free ? { background: "#dcfce7", color: "#15803d" } : { background: "#eef2ff", color: "#4338ca" }}
                        >
                          {s.is_free ? "Besplatna" : "Redovna"}
                        </span>
                      )}
                    </td>
                    <td>
                      <button type="button" className="mhc-btn mhc-btn-sm mhc-btn-danger" onClick={() => handleDeleteSession(s.id)}>
                        Obriši
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showSessionModal && (
        <div className="mhc-modal-overlay" onClick={() => !savingSession && setShowSessionModal(false)}>
          <div className="mhc-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="mhc-modal-title">Nova sesija</h3>
            <div className="mhc-field">
              <label>Datum i vreme *</label>
              <input type="datetime-local" className="mhc-input" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
            </div>
            <div className="mhc-field">
              <label>Terapeut</label>
              <select className="mhc-select" value={sessionTherapist} onChange={(e) => setSessionTherapist(e.target.value)}>
                <option value="">Nedodeljen</option>
                {therapists.map((t) => (
                  <option key={t.user_id} value={t.user_id}>
                    {t.full_name || t.email}
                  </option>
                ))}
              </select>
            </div>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 4px" }}>
              Da li je sesija besplatna izračunava se automatski na osnovu redosleda klijentovih sesija.
            </p>
            {sessionError && <div className="mhc-error">{sessionError}</div>}
            <div className="mhc-modal-actions">
              <button type="button" className="mhc-btn mhc-btn-secondary" onClick={() => setShowSessionModal(false)} disabled={savingSession}>
                Otkaži
              </button>
              <button type="button" className="mhc-btn mhc-btn-primary" onClick={handleAddSession} disabled={savingSession}>
                {savingSession ? "Čuvanje…" : "Dodaj sesiju"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminClientDetail;
