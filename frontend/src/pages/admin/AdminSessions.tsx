import React, { useEffect, useState } from "react";
import axios from "axios";
import DateRangePicker from "./DateRangePicker";
import { DateRange, computeRange, rangeQueryParams } from "./dateRange";
import { backendBase, SessionRow, Therapist, Client, formatDateTime, SESSION_STATUS_LABELS, GENDER_LABELS } from "./adminApi";

const PAGE_SIZE = 25;

const AdminSessions: React.FC = () => {
  const [range, setRange] = useState<DateRange>(() => computeRange("current_year"));
  const [therapistFilter, setTherapistFilter] = useState("");
  const [freeFilter, setFreeFilter] = useState("");
  const [page, setPage] = useState(1);

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SessionRow | null>(null);
  const [form, setForm] = useState({ klijent_id: "", therapist_id: "", pocetak: "", status: "zakazano", client_gender: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setPage(1);
  }, [therapistFilter, freeFilter, range]);

  useEffect(() => {
    axios.get(`${backendBase}/admin/therapists`).then((res) => setTherapists(res.data)).catch(() => {});
    axios
      .get(`${backendBase}/admin/clients`, { params: { page_size: 200 } })
      .then((res) => setClients(res.data.data))
      .catch(() => {});
  }, []);

  const load = () => {
    setLoading(true);
    setError("");
    axios
      .get(`${backendBase}/admin/sessions`, {
        params: {
          ...rangeQueryParams(range),
          therapist_id: therapistFilter || undefined,
          is_free: freeFilter || undefined,
          page,
          page_size: PAGE_SIZE,
        },
      })
      .then((res) => {
        setSessions(res.data.data);
        setTotal(res.data.total);
      })
      .catch(() => setError("Greška pri učitavanju sesija."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapistFilter, freeFilter, page, range]);

  const openCreate = () => {
    setEditing(null);
    setForm({ klijent_id: "", therapist_id: "", pocetak: "", status: "zakazano", client_gender: "" });
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (s: SessionRow) => {
    setEditing(s);
    const currentClient = clients.find((c) => c.id === s.klijent_id);
    setForm({
      klijent_id: s.klijent_id ? String(s.klijent_id) : "",
      therapist_id: s.therapist_id ? String(s.therapist_id) : "",
      pocetak: s.pocetak.slice(0, 16),
      status: s.status,
      client_gender: currentClient?.gender || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleClientSelect = (clientId: string) => {
    const selected = clients.find((c) => String(c.id) === clientId);
    setForm({ ...form, klijent_id: clientId, client_gender: selected?.gender || form.client_gender });
  };

  const handleSave = () => {
    if (!form.pocetak || (!editing && !form.klijent_id)) {
      setFormError("Klijent i datum su obavezni.");
      return;
    }
    setSaving(true);
    setFormError("");

    const req = editing
      ? axios.put(`${backendBase}/admin/sessions/${editing.id}`, {
          therapist_id: form.therapist_id ? Number(form.therapist_id) : 0,
          pocetak: form.pocetak,
          status: form.status,
          client_gender: form.client_gender || null,
        })
      : axios.post(`${backendBase}/admin/sessions`, {
          klijent_id: Number(form.klijent_id),
          therapist_id: form.therapist_id ? Number(form.therapist_id) : null,
          pocetak: form.pocetak,
          status: form.status,
          client_gender: form.client_gender || null,
        });

    req
      .then(() => {
        setShowModal(false);
        load();
      })
      .catch((err) => setFormError(err?.response?.data?.detail || "Greška pri čuvanju sesije."))
      .finally(() => setSaving(false));
  };

  const handleDelete = (id: number) => {
    axios
      .delete(`${backendBase}/admin/sessions/${id}`)
      .then(() => load())
      .catch(() => setError("Greška pri brisanju sesije."));
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="mhc-page-header">
        <div>
          <h1 className="mhc-page-title">Sesije</h1>
          <p className="mhc-page-sub">Sve sesije centra, sa automatski izračunatim besplatnim sesijama.</p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {error && <div className="mhc-error">{error}</div>}

      <div className="mhc-toolbar">
        <select className="mhc-select" value={therapistFilter} onChange={(e) => setTherapistFilter(e.target.value)}>
          <option value="">Svi terapeuti</option>
          {therapists.map((t) => (
            <option key={t.user_id} value={t.user_id}>
              {t.full_name || t.email}
            </option>
          ))}
        </select>
        <select className="mhc-select" value={freeFilter} onChange={(e) => setFreeFilter(e.target.value)}>
          <option value="">Sve sesije</option>
          <option value="true">Samo besplatne</option>
          <option value="false">Samo redovne</option>
        </select>
        <button type="button" className="mhc-btn mhc-btn-primary" onClick={openCreate}>
          + Nova sesija
        </button>
      </div>

      <div className="mhc-panel" style={{ padding: 0 }}>
        <div className="mhc-table-wrap">
          {loading ? (
            <div className="mhc-loading">Učitavanje…</div>
          ) : sessions.length === 0 ? (
            <div className="mhc-empty">Nema sesija koje odgovaraju filterima.</div>
          ) : (
            <table className="mhc-table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Klijent</th>
                  <th>Terapeut</th>
                  <th>Sesija #</th>
                  <th>Besplatna</th>
                  <th>Status</th>
                  <th>Akcije</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>{formatDateTime(s.pocetak)}</td>
                    <td>{s.klijent_name || "—"}</td>
                    <td>{s.therapist_name || "—"}</td>
                    <td>{s.session_number ?? "—"}</td>
                    <td>{s.is_free === null ? "—" : s.is_free ? "Da" : "Ne"}</td>
                    <td>{SESSION_STATUS_LABELS[s.status] || s.status}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button type="button" className="mhc-btn mhc-btn-sm mhc-btn-secondary" onClick={() => openEdit(s)}>
                        Izmeni
                      </button>
                      <button type="button" className="mhc-btn mhc-btn-sm mhc-btn-danger" onClick={() => handleDelete(s.id)}>
                        Obriši
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {total > PAGE_SIZE && (
          <div className="mhc-pagination" style={{ padding: "10px 16px" }}>
            <span>
              {total} sesija · strana {page}/{totalPages}
            </span>
            <button className="mhc-btn mhc-btn-sm mhc-btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ← Prethodna
            </button>
            <button className="mhc-btn mhc-btn-sm mhc-btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Sledeća →
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="mhc-modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="mhc-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="mhc-modal-title">{editing ? "Izmeni sesiju" : "Nova sesija"}</h3>

            {!editing && (
              <div className="mhc-field">
                <label>Klijent *</label>
                <select className="mhc-select" value={form.klijent_id} onChange={(e) => handleClientSelect(e.target.value)}>
                  <option value="">Izaberite klijenta</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.ime} {c.prezime}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="mhc-field">
              <label>Pol klijenta</label>
              <select className="mhc-select" value={form.client_gender} onChange={(e) => setForm({ ...form, client_gender: e.target.value })}>
                <option value="">Nepoznato</option>
                <option value="female">{GENDER_LABELS.female}</option>
                <option value="male">{GENDER_LABELS.male}</option>
                <option value="other">{GENDER_LABELS.other}</option>
              </select>
            </div>
            <div className="mhc-field">
              <label>Terapeut</label>
              <select className="mhc-select" value={form.therapist_id} onChange={(e) => setForm({ ...form, therapist_id: e.target.value })}>
                <option value="">Nedodeljen</option>
                {therapists.map((t) => (
                  <option key={t.user_id} value={t.user_id}>
                    {t.full_name || t.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="mhc-field">
              <label>Datum i vreme *</label>
              <input type="datetime-local" className="mhc-input" value={form.pocetak} onChange={(e) => setForm({ ...form, pocetak: e.target.value })} />
            </div>
            <div className="mhc-field">
              <label>Status</label>
              <select className="mhc-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="zakazano">{SESSION_STATUS_LABELS.zakazano}</option>
                <option value="otkazano">{SESSION_STATUS_LABELS.otkazano}</option>
                <option value="besplatno">{SESSION_STATUS_LABELS.besplatno}</option>
              </select>
            </div>

            {formError && <div className="mhc-error">{formError}</div>}

            <div className="mhc-modal-actions">
              <button type="button" className="mhc-btn mhc-btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>
                Otkaži
              </button>
              <button type="button" className="mhc-btn mhc-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Čuvanje…" : "Sačuvaj"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSessions;
