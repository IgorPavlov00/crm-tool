import React, { useEffect, useState } from "react";
import axios from "axios";
import DateRangePicker from "./DateRangePicker";
import { DateRange, computeRange, rangeQueryParams } from "./dateRange";
import { backendBase, formatDate } from "./adminApi";

interface MatrixResponse {
  meetings: { id: number; date: string; type: string }[];
  therapists: { user_profile_id: number; name: string; active: boolean }[];
  matrix: Record<string, Record<string, string>>;
  stats: Record<string, { meetings_held: number; attended: number; absent: number; excused: number; percentage: number | null }>;
}

interface MeetingDetail {
  id: number;
  date: string;
  type: string;
  notes: string | null;
  attendance: { user_profile_id: number; name: string; active: boolean; status: string | null }[];
}

const STATUS_MARKS: Record<string, { label: string; bg: string; color: string }> = {
  present: { label: "✓", bg: "#dcfce7", color: "#15803d" },
  absent: { label: "−", bg: "#fee2e2", color: "#b91c1c" },
  excused: { label: "+", bg: "#fef3c7", color: "#92400e" },
};

const CYCLE: (string | null)[] = [null, "present", "absent", "excused"];

const AdminTeamAttendance: React.FC = () => {
  const [range, setRange] = useState<DateRange>(() => computeRange("current_year"));
  const [matrix, setMatrix] = useState<MatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newType, setNewType] = useState("team_meeting");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [activeMeeting, setActiveMeeting] = useState<MeetingDetail | null>(null);
  const [meetingLoading, setMeetingLoading] = useState(false);

  const loadMatrix = () => {
    setLoading(true);
    setError("");
    axios
      .get(`${backendBase}/admin/team-attendance/matrix`, { params: rangeQueryParams(range) })
      .then((res) => setMatrix(res.data))
      .catch(() => setError("Greška pri učitavanju prisustva."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMatrix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const handleCreateMeeting = () => {
    if (!newDate) {
      setCreateError("Datum je obavezan.");
      return;
    }
    setCreating(true);
    setCreateError("");
    axios
      .post(`${backendBase}/admin/team-attendance/meetings`, { date: newDate, type: newType })
      .then(() => {
        setShowCreate(false);
        setNewDate("");
        loadMatrix();
      })
      .catch((err) => setCreateError(err?.response?.data?.detail || "Greška pri kreiranju sastanka."))
      .finally(() => setCreating(false));
  };

  const openMeeting = (meetingId: number) => {
    setMeetingLoading(true);
    axios
      .get(`${backendBase}/admin/team-attendance/meetings/${meetingId}`)
      .then((res) => setActiveMeeting(res.data))
      .catch(() => setError("Greška pri učitavanju sastanka."))
      .finally(() => setMeetingLoading(false));
  };

  const cycleStatus = (userProfileId: number) => {
    if (!activeMeeting) return;
    setActiveMeeting({
      ...activeMeeting,
      attendance: activeMeeting.attendance.map((a) => {
        if (a.user_profile_id !== userProfileId) return a;
        const idx = CYCLE.indexOf(a.status);
        const next = CYCLE[(idx + 1) % CYCLE.length];
        return { ...a, status: next };
      }),
    });
  };

  const saveAttendance = () => {
    if (!activeMeeting) return;
    const records = activeMeeting.attendance.filter((a) => a.status).map((a) => ({ user_profile_id: a.user_profile_id, status: a.status as string }));
    axios
      .put(`${backendBase}/admin/team-attendance/meetings/${activeMeeting.id}/attendance`, { records })
      .then(() => {
        setActiveMeeting(null);
        loadMatrix();
      })
      .catch(() => setError("Greška pri čuvanju prisustva."));
  };

  const deleteMeeting = (meetingId: number) => {
    axios
      .delete(`${backendBase}/admin/team-attendance/meetings/${meetingId}`)
      .then(() => loadMatrix())
      .catch(() => setError("Greška pri brisanju sastanka."));
  };

  return (
    <div>
      <div className="mhc-page-header">
        <div>
          <h1 className="mhc-page-title">Prisustvo tima</h1>
          <p className="mhc-page-sub">Evidencija prisustva na timskim sastancima.</p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {error && <div className="mhc-error">{error}</div>}

      <div className="mhc-toolbar">
        <button type="button" className="mhc-btn mhc-btn-primary" onClick={() => setShowCreate(true)}>
          + Novi sastanak
        </button>
      </div>

      {loading ? (
        <div className="mhc-loading">Učitavanje…</div>
      ) : matrix ? (
        <>
          <div className="mhc-panel">
            <h3 className="mhc-panel-title">Matrica prisustva</h3>
            {matrix.meetings.length === 0 ? (
              <div className="mhc-empty">Nema sastanaka u izabranom periodu.</div>
            ) : (
              <div className="mhc-matrix-wrap">
                <table className="mhc-matrix">
                  <thead>
                    <tr>
                      <th>Terapeut</th>
                      {matrix.meetings.map((m) => (
                        <th key={m.id}>
                          <span className="mhc-table-link" onClick={() => openMeeting(m.id)}>
                            {formatDate(m.date)}
                          </span>
                          <br />
                          <button
                            type="button"
                            style={{ border: "none", background: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 11 }}
                            onClick={() => deleteMeeting(m.id)}
                            title="Obriši sastanak"
                          >
                            ✕
                          </button>
                        </th>
                      ))}
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.therapists.map((t) => {
                      const stat = matrix.stats[String(t.user_profile_id)];
                      return (
                        <tr key={t.user_profile_id}>
                          <td>{t.name}</td>
                          {matrix.meetings.map((m) => {
                            const status = matrix.matrix[String(t.user_profile_id)]?.[String(m.id)];
                            const mark = status ? STATUS_MARKS[status] : null;
                            return (
                              <td key={m.id}>
                                {mark ? (
                                  <span className="mhc-attend-mark" style={{ background: mark.bg, color: mark.color }}>
                                    {mark.label}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                            );
                          })}
                          <td>{stat?.percentage !== null && stat?.percentage !== undefined ? `${stat.percentage}%` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mhc-panel">
            <h3 className="mhc-panel-title">Statistika prisustva</h3>
            <div className="mhc-table-wrap">
              <table className="mhc-table">
                <thead>
                  <tr>
                    <th>Terapeut</th>
                    <th>Sastanaka</th>
                    <th>Prisutan</th>
                    <th>Odsutan</th>
                    <th>Opravdano</th>
                    <th>Procenat</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.therapists.map((t) => {
                    const s = matrix.stats[String(t.user_profile_id)];
                    return (
                      <tr key={t.user_profile_id}>
                        <td>{t.name}</td>
                        <td>{s?.meetings_held ?? 0}</td>
                        <td>{s?.attended ?? 0}</td>
                        <td>{s?.absent ?? 0}</td>
                        <td>{s?.excused ?? 0}</td>
                        <td>{s?.percentage !== null && s?.percentage !== undefined ? `${s.percentage}%` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {showCreate && (
        <div className="mhc-modal-overlay" onClick={() => !creating && setShowCreate(false)}>
          <div className="mhc-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="mhc-modal-title">Novi sastanak</h3>
            <div className="mhc-field">
              <label>Datum *</label>
              <input type="date" className="mhc-input" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div className="mhc-field">
              <label>Tip</label>
              <input className="mhc-input" value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="team_meeting" />
            </div>
            {createError && <div className="mhc-error">{createError}</div>}
            <div className="mhc-modal-actions">
              <button type="button" className="mhc-btn mhc-btn-secondary" onClick={() => setShowCreate(false)} disabled={creating}>
                Otkaži
              </button>
              <button type="button" className="mhc-btn mhc-btn-primary" onClick={handleCreateMeeting} disabled={creating}>
                {creating ? "Kreiranje…" : "Kreiraj"}
              </button>
            </div>
          </div>
        </div>
      )}

      {(activeMeeting || meetingLoading) && (
        <div className="mhc-modal-overlay" onClick={() => setActiveMeeting(null)}>
          <div className="mhc-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="mhc-modal-title">Prisustvo — {activeMeeting ? formatDate(activeMeeting.date) : ""}</h3>
            {meetingLoading || !activeMeeting ? (
              <div className="mhc-loading">Učitavanje…</div>
            ) : (
              <>
                <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 12px" }}>
                  Kliknite na status da promenite: — → ✓ prisutan → − odsutan → + opravdano.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {activeMeeting.attendance.map((a) => {
                    const mark = a.status ? STATUS_MARKS[a.status] : null;
                    return (
                      <div key={a.user_profile_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 13.5, color: "#1e293b" }}>{a.name}</span>
                        <button
                          type="button"
                          className="mhc-attend-mark"
                          style={{ background: mark?.bg || "#f1f5f9", color: mark?.color || "#94a3b8", border: "none", width: 32, height: 32 }}
                          onClick={() => cycleStatus(a.user_profile_id)}
                        >
                          {mark?.label || "—"}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="mhc-modal-actions">
                  <button type="button" className="mhc-btn mhc-btn-secondary" onClick={() => setActiveMeeting(null)}>
                    Otkaži
                  </button>
                  <button type="button" className="mhc-btn mhc-btn-primary" onClick={saveAttendance}>
                    Sačuvaj prisustvo
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTeamAttendance;
