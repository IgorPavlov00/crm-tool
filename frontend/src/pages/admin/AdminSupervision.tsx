import React, { useEffect, useState } from "react";
import axios from "axios";
import { backendBase, formatDate, formatDateTime } from "./adminApi";

interface Signup {
  user_profile_id: number;
  name: string;
  signed_up_at: string | null;
}

interface EventRow {
  id: number;
  title: string;
  type: string;
  starts_at: string;
  location: string | null;
  description: string | null;
  signups: Signup[];
}

interface Overview {
  events: EventRow[];
  therapists: { user_profile_id: number; name: string; active: boolean; signup_count: number }[];
  total_events: number;
  total_signups: number;
}

interface FormState {
  id: number | null;
  title: string;
  type: string;
  starts_at: string; // yyyy-MM-ddTHH:mm (datetime-local)
  location: string;
  description: string;
}

const TYPE_LABELS: Record<string, string> = {
  supervizija: "Supervizija",
  desavanje: "Dešavanje",
};

const emptyForm = (): FormState => ({
  id: null,
  title: "Supervizija",
  type: "supervizija",
  starts_at: "",
  location: "",
  description: "",
});

const formatTime = (value: string) => {
  const d = new Date(value);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const AdminSupervision: React.FC = () => {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [openEventId, setOpenEventId] = useState<number | null>(null);

  const load = () => {
    setError("");
    return axios
      .get<Overview>(`${backendBase}/admin/supervision`)
      .then((res) => setData(res.data))
      .catch(() => setError("Greška pri učitavanju događaja."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openEdit = (e: EventRow) =>
    setForm({
      id: e.id,
      title: e.title,
      type: e.type,
      starts_at: e.starts_at.slice(0, 16),
      location: e.location || "",
      description: e.description || "",
    });

  const save = () => {
    if (!form) return;
    if (!form.title.trim() || !form.starts_at) {
      setFormError("Naziv, datum i vreme su obavezni.");
      return;
    }
    setSaving(true);
    setFormError("");
    const payload = {
      title: form.title,
      type: form.type,
      starts_at: form.starts_at,
      location: form.location,
      description: form.description,
    };
    const request = form.id
      ? axios.put(`${backendBase}/admin/supervision/events/${form.id}`, payload)
      : axios.post(`${backendBase}/admin/supervision/events`, payload);
    request
      .then(() => {
        setForm(null);
        load();
      })
      .catch((err) => setFormError(err?.response?.data?.message || "Greška pri čuvanju događaja."))
      .finally(() => setSaving(false));
  };

  const deleteEvent = (e: EventRow) => {
    axios
      .delete(`${backendBase}/admin/supervision/events/${e.id}`)
      .then(() => load())
      .catch(() => setError("Greška pri brisanju događaja."));
  };

  const removeSignup = (eventId: number, userProfileId: number) => {
    axios
      .delete(`${backendBase}/admin/supervision/events/${eventId}/signups/${userProfileId}`)
      .then(() => load())
      .catch(() => setError("Greška pri uklanjanju prijave."));
  };

  const now = new Date();
  const upcomingCount = data ? data.events.filter((e) => new Date(e.starts_at) >= now).length : 0;
  const openEvent = data?.events.find((e) => e.id === openEventId) || null;
  const therapistStats = data ? [...data.therapists].sort((a, b) => b.signup_count - a.signup_count) : [];

  return (
    <div>
      <div className="mhc-page-header">
        <div>
          <h1 className="mhc-page-title">Dešavanja i supervizije</h1>
          <p className="mhc-page-sub">
            Događaji koje ovde kreirate automatski se prikazuju svim terapeutima, koji se na njih prijavljuju.
          </p>
        </div>
      </div>

      {error && <div className="mhc-error">{error}</div>}

      <div className="mhc-toolbar">
        <button type="button" className="mhc-btn mhc-btn-primary" onClick={() => { setFormError(""); setForm(emptyForm()); }}>
          + Novi događaj
        </button>
      </div>

      {loading ? (
        <div className="mhc-loading">Učitavanje…</div>
      ) : data ? (
        <>
          <div className="mhc-cards-grid">
            <div className="mhc-card">
              <div className="mhc-card-label">Ukupno događaja</div>
              <div className="mhc-card-value">{data.total_events}</div>
            </div>
            <div className="mhc-card">
              <div className="mhc-card-label">Predstojećih</div>
              <div className="mhc-card-value">{upcomingCount}</div>
            </div>
            <div className="mhc-card">
              <div className="mhc-card-label">Ukupno prijava</div>
              <div className="mhc-card-value">{data.total_signups}</div>
            </div>
          </div>

          <div className="mhc-panel">
            <h3 className="mhc-panel-title">Događaji</h3>
            {data.events.length === 0 ? (
              <div className="mhc-empty">Još nema događaja.</div>
            ) : (
              <div className="mhc-table-wrap">
                <table className="mhc-table">
                  <thead>
                    <tr>
                      <th>Datum</th>
                      <th>Vreme</th>
                      <th>Naziv</th>
                      <th>Tip</th>
                      <th>Prijavljeni</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.map((e) => {
                      const past = new Date(e.starts_at) < now;
                      return (
                        <tr key={e.id} style={past ? { opacity: 0.6 } : undefined}>
                          <td>{formatDate(e.starts_at)}</td>
                          <td>{formatTime(e.starts_at)}h</td>
                          <td>
                            {e.title}
                            {e.location && (
                              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{e.location}</div>
                            )}
                          </td>
                          <td>{TYPE_LABELS[e.type] || e.type}</td>
                          <td>
                            <span className="mhc-table-link" onClick={() => setOpenEventId(e.id)}>
                              {e.signups.length} {e.signups.length === 1 ? "terapeut" : "terapeuta"}
                            </span>
                          </td>
                          <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                            <button type="button" className="mhc-btn mhc-btn-secondary mhc-btn-sm" onClick={() => openEdit(e)}>
                              Izmeni
                            </button>{" "}
                            <button type="button" className="mhc-btn mhc-btn-danger mhc-btn-sm" onClick={() => deleteEvent(e)}>
                              Obriši
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mhc-panel">
            <h3 className="mhc-panel-title">Prijave po terapeutu</h3>
            {therapistStats.length === 0 ? (
              <div className="mhc-empty">Nema terapeuta.</div>
            ) : (
              <div className="mhc-table-wrap">
                <table className="mhc-table">
                  <thead>
                    <tr>
                      <th>Terapeut</th>
                      {data.events.map((e) => (
                        <th key={e.id} title={e.title}>{formatDate(e.starts_at)}</th>
                      ))}
                      <th>Ukupno</th>
                    </tr>
                  </thead>
                  <tbody>
                    {therapistStats.map((t) => (
                      <tr key={t.user_profile_id}>
                        <td>{t.name}</td>
                        {data.events.map((e) => {
                          const signed = e.signups.some((s) => s.user_profile_id === t.user_profile_id);
                          return (
                            <td key={e.id}>
                              {signed ? (
                                <span className="mhc-attend-mark" style={{ background: "#dcfce7", color: "#15803d" }}>✓</span>
                              ) : (
                                "—"
                              )}
                            </td>
                          );
                        })}
                        <td><strong>{t.signup_count}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}

      {form && (
        <div className="mhc-modal-overlay" onClick={() => !saving && setForm(null)}>
          <div className="mhc-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="mhc-modal-title">{form.id ? "Izmena događaja" : "Novi događaj"}</h3>
            <div className="mhc-field">
              <label>Naziv *</label>
              <input className="mhc-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="mhc-field">
              <label>Tip</label>
              <select className="mhc-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="supervizija">Supervizija</option>
                <option value="desavanje">Dešavanje</option>
              </select>
            </div>
            <div className="mhc-field">
              <label>Datum i vreme *</label>
              <input
                type="datetime-local"
                className="mhc-input"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              />
            </div>
            <div className="mhc-field">
              <label>Lokacija</label>
              <input className="mhc-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="mhc-field">
              <label>Opis</label>
              <textarea
                className="mhc-input"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            {formError && <div className="mhc-error">{formError}</div>}
            <div className="mhc-modal-actions">
              <button type="button" className="mhc-btn mhc-btn-secondary" onClick={() => setForm(null)} disabled={saving}>
                Otkaži
              </button>
              <button type="button" className="mhc-btn mhc-btn-primary" onClick={save} disabled={saving}>
                {saving ? "Čuvanje…" : "Sačuvaj"}
              </button>
            </div>
          </div>
        </div>
      )}

      {openEvent && (
        <div className="mhc-modal-overlay" onClick={() => setOpenEventId(null)}>
          <div className="mhc-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="mhc-modal-title">
              {openEvent.title} — {formatDate(openEvent.starts_at)} u {formatTime(openEvent.starts_at)}h
            </h3>
            {openEvent.signups.length === 0 ? (
              <div className="mhc-empty">Još se niko nije prijavio.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {openEvent.signups.map((s) => (
                  <div key={s.user_profile_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13.5, color: "var(--text-primary)" }}>{s.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                        Prijava: {formatDateTime(s.signed_up_at ? `${s.signed_up_at}Z` : null)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="mhc-btn mhc-btn-secondary mhc-btn-sm"
                      onClick={() => removeSignup(openEvent.id, s.user_profile_id)}
                    >
                      Ukloni
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mhc-modal-actions">
              <button type="button" className="mhc-btn mhc-btn-secondary" onClick={() => setOpenEventId(null)}>
                Zatvori
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSupervision;
