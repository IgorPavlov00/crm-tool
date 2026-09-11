import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import DateRangePicker from "./DateRangePicker";
import { DateRange, computeRange, rangeQueryParams } from "./dateRange";
import {
  backendBase,
  Client,
  Therapist,
  GENDER_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  formatDate,
} from "./adminApi";

const PAGE_SIZE = 20;

interface ClientForm {
  ime: string;
  prezime: string;
  email: string;
  broj_telefona: string;
  gender: string;
  therapist_id: string;
  status: string;
  date_started: string;
  date_completed: string;
}

const emptyForm: ClientForm = {
  ime: "",
  prezime: "",
  email: "",
  broj_telefona: "",
  gender: "",
  therapist_id: "",
  status: "active",
  date_started: "",
  date_completed: "",
};

const AdminClients: React.FC = () => {
  const navigate = useNavigate();
  const [range, setRange] = useState<DateRange>(() => computeRange("all_time"));
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [therapistFilter, setTherapistFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);

  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, therapistFilter, statusFilter, genderFilter, sort, range]);

  useEffect(() => {
    axios
      .get(`${backendBase}/admin/therapists`)
      .then((res) => setTherapists(res.data))
      .catch(() => {});
  }, []);

  const load = () => {
    setLoading(true);
    setError("");
    axios
      .get(`${backendBase}/admin/clients`, {
        params: {
          ...rangeQueryParams(range),
          search: debouncedSearch || undefined,
          therapist_id: therapistFilter || undefined,
          status: statusFilter || undefined,
          gender: genderFilter || undefined,
          sort,
          page,
          page_size: PAGE_SIZE,
        },
      })
      .then((res) => {
        setClients(res.data.data);
        setTotal(res.data.total);
      })
      .catch(() => setError("Greška pri učitavanju klijenata."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, therapistFilter, statusFilter, genderFilter, sort, page, range]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (c: Client) => {
    setEditingId(c.id);
    setForm({
      ime: c.ime,
      prezime: c.prezime,
      email: c.email || "",
      broj_telefona: c.broj_telefona || "",
      gender: c.gender || "",
      therapist_id: c.therapist_id ? String(c.therapist_id) : "",
      status: c.status,
      date_started: c.date_started || "",
      date_completed: c.date_completed || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.ime.trim() || !form.prezime.trim()) {
      setFormError("Ime i prezime su obavezni.");
      return;
    }
    setSaving(true);
    setFormError("");

    const payload: any = {
      ime: form.ime.trim(),
      prezime: form.prezime.trim(),
      email: form.email || null,
      broj_telefona: form.broj_telefona || null,
      gender: form.gender || null,
      therapist_id: form.therapist_id ? Number(form.therapist_id) : null,
      status: form.status,
      date_started: form.date_started || null,
      date_completed: form.date_completed || null,
    };

    const req = editingId
      ? axios.put(`${backendBase}/admin/clients/${editingId}`, payload)
      : axios.post(`${backendBase}/admin/clients`, payload);

    req
      .then(() => {
        setShowModal(false);
        load();
      })
      .catch((err) => setFormError(err?.response?.data?.detail || "Greška pri čuvanju klijenta."))
      .finally(() => setSaving(false));
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="mhc-page-header">
        <div>
          <h1 className="mhc-page-title">Klijenti</h1>
          <p className="mhc-page-sub">Evidencija klijenata centra.</p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {error && <div className="mhc-error">{error}</div>}

      <div className="mhc-toolbar">
        <input
          className="mhc-input mhc-search"
          placeholder="Pretraga klijenata…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="mhc-select" value={therapistFilter} onChange={(e) => setTherapistFilter(e.target.value)}>
          <option value="">Svi terapeuti</option>
          {therapists.map((t) => (
            <option key={t.user_id} value={t.user_id}>
              {t.full_name || t.email}
            </option>
          ))}
        </select>
        <select className="mhc-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Svi statusi</option>
          <option value="active">Aktivan</option>
          <option value="completed">Završen</option>
          <option value="archived">Arhiviran</option>
        </select>
        <select className="mhc-select" value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
          <option value="">Svi polovi</option>
          <option value="female">Žensko</option>
          <option value="male">Muško</option>
          <option value="other">Drugo</option>
          <option value="unknown">Nepoznato</option>
        </select>
        <select className="mhc-select" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="recent">Najnoviji</option>
          <option value="name">Po imenu</option>
          <option value="sessions">Po broju sesija</option>
        </select>
        <button type="button" className="mhc-btn mhc-btn-primary" onClick={openCreate}>
          + Dodaj klijenta
        </button>
      </div>

      <div className="mhc-panel" style={{ padding: 0 }}>
        <div className="mhc-table-wrap">
          {loading ? (
            <div className="mhc-loading">Učitavanje…</div>
          ) : clients.length === 0 ? (
            <div className="mhc-empty">Nema klijenata koji odgovaraju filterima.</div>
          ) : (
            <table className="mhc-table">
              <thead>
                <tr>
                  <th>Klijent</th>
                  <th>Pol</th>
                  <th>Terapeut</th>
                  <th>Status</th>
                  <th>Sesija</th>
                  <th>Datum početka</th>
                  <th>Akcije</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="mhc-table-link" onClick={() => navigate(`/therapist/admin/clients/${c.id}`)}>
                        {c.ime} {c.prezime}
                      </span>
                    </td>
                    <td>{c.gender ? GENDER_LABELS[c.gender] : "—"}</td>
                    <td>{c.therapist_name || "Nedodeljen"}</td>
                    <td>
                      <span className="mhc-badge" style={STATUS_COLORS[c.status]}>
                        {STATUS_LABELS[c.status] || c.status}
                      </span>
                    </td>
                    <td>{c.session_count ?? "—"}</td>
                    <td>{formatDate(c.date_started)}</td>
                    <td>
                      <button type="button" className="mhc-btn mhc-btn-sm mhc-btn-secondary" onClick={() => openEdit(c)}>
                        Izmeni
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
              {total} klijenata · strana {page}/{totalPages}
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
            <h3 className="mhc-modal-title">{editingId ? "Izmeni klijenta" : "Dodaj klijenta"}</h3>

            <div style={{ display: "flex", gap: 10 }}>
              <div className="mhc-field" style={{ flex: 1 }}>
                <label>Ime *</label>
                <input className="mhc-input" value={form.ime} onChange={(e) => setForm({ ...form, ime: e.target.value })} />
              </div>
              <div className="mhc-field" style={{ flex: 1 }}>
                <label>Prezime *</label>
                <input className="mhc-input" value={form.prezime} onChange={(e) => setForm({ ...form, prezime: e.target.value })} />
              </div>
            </div>

            <div className="mhc-field">
              <label>Email</label>
              <input className="mhc-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="mhc-field">
              <label>Telefon</label>
              <input className="mhc-input" value={form.broj_telefona} onChange={(e) => setForm({ ...form, broj_telefona: e.target.value })} />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <div className="mhc-field" style={{ flex: 1 }}>
                <label>Pol</label>
                <select className="mhc-select" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="">Nepoznato</option>
                  <option value="female">Žensko</option>
                  <option value="male">Muško</option>
                  <option value="other">Drugo</option>
                </select>
              </div>
              <div className="mhc-field" style={{ flex: 1 }}>
                <label>Status</label>
                <select className="mhc-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="active">Aktivan</option>
                  <option value="completed">Završen</option>
                  <option value="archived">Arhiviran</option>
                </select>
              </div>
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

            <div style={{ display: "flex", gap: 10 }}>
              <div className="mhc-field" style={{ flex: 1 }}>
                <label>Datum početka</label>
                <input type="date" className="mhc-input" value={form.date_started} onChange={(e) => setForm({ ...form, date_started: e.target.value })} />
              </div>
              {form.status === "completed" && (
                <div className="mhc-field" style={{ flex: 1 }}>
                  <label>Datum završetka</label>
                  <input type="date" className="mhc-input" value={form.date_completed} onChange={(e) => setForm({ ...form, date_completed: e.target.value })} />
                </div>
              )}
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

export default AdminClients;
