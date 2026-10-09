import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

interface SupervisionEvent {
  id: number;
  title: string;
  type: "supervizija" | "desavanje" | string;
  starts_at: string;
  location: string | null;
  description: string | null;
  signup_count: number;
  signed_up: boolean;
}

const backendBase = import.meta.env.VITE_API_URL || "http://localhost:8000";

const MONTHS = [
  "Januar", "Februar", "Mart", "April", "Maj", "Jun",
  "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar",
];
const WEEKDAYS = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];

const TYPE_LABELS: Record<string, string> = {
  supervizija: "Supervizija",
  desavanje: "Dešavanje",
};

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const formatTime = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

const formatLongDate = (d: Date) =>
  `${d.getDate()}. ${MONTHS[d.getMonth()].toLowerCase()} ${d.getFullYear()}.`;

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 22,
  boxShadow:
    "0 1px 3px rgba(0,0,0,0.04), 0 12px 32px rgba(15,23,42,0.05), 0 0 0 1px rgba(15,23,42,0.04)",
};

const navBtnStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  background: "#fff",
  color: "#475569",
  cursor: "pointer",
  fontSize: 16,
  lineHeight: 1,
  fontFamily: "inherit",
};

const Supervision: React.FC = () => {
  const [events, setEvents] = useState<SupervisionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const loadEvents = (initial = false) => {
    if (initial) setLoading(true);
    return axios
      .get<SupervisionEvent[]>(`${backendBase}/supervision/events`)
      .then((res) => {
        setEvents(res.data);
        setError("");
        if (initial) {
          // Open on the next upcoming event so it's visible right away.
          const next = res.data.find((e) => new Date(e.starts_at) >= new Date());
          if (next) {
            const d = new Date(next.starts_at);
            setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
            setSelectedDay(dayKey(d));
          }
        }
      })
      .catch(() => setError("Nije moguće učitati događaje."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEvents(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eventsByDay = useMemo(() => {
    const map: Record<string, SupervisionEvent[]> = {};
    for (const e of events) {
      const key = dayKey(new Date(e.starts_at));
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return map;
  }, [events]);

  const toggleSignup = (event: SupervisionEvent) => {
    setBusyId(event.id);
    const url = `${backendBase}/supervision/events/${event.id}/signup`;
    const request = event.signed_up ? axios.delete(url) : axios.post(url);
    request
      .then(() => loadEvents())
      .catch((err) =>
        setError(err?.response?.data?.message || "Prijava nije uspela, pokušajte ponovo."),
      )
      .finally(() => setBusyId(null));
  };

  // Monday-first grid for the visible month
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const result: (Date | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      result.push(new Date(month.getFullYear(), month.getMonth(), d));
    }
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [month]);

  const todayKey = dayKey(new Date());
  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.starts_at) >= now);
  const listed = selectedDay ? eventsByDay[selectedDay] || [] : upcoming;

  const shiftMonth = (delta: number) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2
          style={{
            margin: "0 0 4px",
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 24,
            fontWeight: 600,
            color: "#0f172a",
          }}
        >
          Dešavanja i supervizije
        </h2>
        <p style={{ margin: 0, fontSize: 13.5, color: "#64748b" }}>
          Označeni datumi imaju zakazane događaje. Kliknite na datum i prijavite se.
        </p>
      </div>

      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        {/* Small month calendar */}
        <div style={{ ...cardStyle, width: 320, maxWidth: "100%", flexShrink: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <button type="button" style={navBtnStyle} onClick={() => shiftMonth(-1)} aria-label="Prethodni mesec">
              ‹
            </button>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>
              {MONTHS[month.getMonth()]} {month.getFullYear()}
            </span>
            <button type="button" style={navBtnStyle} onClick={() => shiftMonth(1)} aria-label="Sledeći mesec">
              ›
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "#94a3b8", paddingBottom: 4 }}
              >
                {w}
              </div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={`empty-${i}`} />;
              const key = dayKey(d);
              const dayEvents = eventsByDay[key];
              const hasEvents = !!dayEvents;
              const signedUp = dayEvents?.some((e) => e.signed_up);
              const isSelected = selectedDay === key;
              const isToday = key === todayKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(isSelected ? null : key)}
                  title={hasEvents ? dayEvents.map((e) => e.title).join(", ") : undefined}
                  style={{
                    position: "relative",
                    aspectRatio: "1",
                    borderRadius: 10,
                    border: isSelected ? "2px solid #4f46e5" : "2px solid transparent",
                    background: hasEvents ? (signedUp ? "#dcfce7" : "#e0e7ff") : "transparent",
                    color: hasEvents ? (signedUp ? "#15803d" : "#3730a3") : "#334155",
                    fontWeight: hasEvents || isToday ? 700 : 400,
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textDecoration: isToday ? "underline" : "none",
                  }}
                >
                  {d.getDate()}
                  {hasEvents && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: 4,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: signedUp ? "#16a34a" : "#4f46e5",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 14, marginTop: 14, fontSize: 11.5, color: "#64748b" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "#e0e7ff" }} />
              Događaj
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: "#dcfce7" }} />
              Prijavljeni ste
            </span>
          </div>
        </div>

        {/* Events for the selected day (or all upcoming) */}
        <div style={{ ...cardStyle, flex: 1, minWidth: 260 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#0f172a" }}>
              {selectedDay
                ? formatLongDate(new Date(`${selectedDay}T00:00:00`))
                : "Predstojeći događaji"}
            </h3>
            {selectedDay && (
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                style={{
                  border: "none",
                  background: "none",
                  color: "#4f46e5",
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Svi predstojeći
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ fontSize: 13, color: "#94a3b8" }}>Učitavanje…</div>
          ) : listed.length === 0 ? (
            <div style={{ fontSize: 13, color: "#94a3b8" }}>
              {selectedDay ? "Nema događaja za ovaj datum." : "Trenutno nema zakazanih događaja."}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {listed.map((e) => {
                const start = new Date(e.starts_at);
                const past = start < now;
                const busy = busyId === e.id;
                return (
                  <div
                    key={e.id}
                    style={{
                      border: `1px solid ${e.signed_up ? "#bbf7d0" : "#e2e8f0"}`,
                      background: e.signed_up ? "#f0fdf4" : "#fff",
                      borderRadius: 12,
                      padding: 16,
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: 0.4,
                            color: "#4f46e5",
                            background: "#eef2ff",
                            borderRadius: 6,
                            padding: "2px 7px",
                          }}
                        >
                          {TYPE_LABELS[e.type] || e.type}
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{e.title}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "#475569" }}>
                        {formatLongDate(start)} u {formatTime(start)}h
                        {e.location ? ` · ${e.location}` : ""}
                      </div>
                      {e.description && (
                        <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>{e.description}</div>
                      )}
                      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
                        Prijavljenih: {e.signup_count}
                      </div>
                    </div>
                    {past ? (
                      <span style={{ fontSize: 13, color: "#94a3b8" }}>
                        {e.signed_up ? "Bili ste prijavljeni" : "Završeno"}
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => toggleSignup(e)}
                        style={{
                          padding: "9px 16px",
                          borderRadius: 10,
                          border: e.signed_up ? "1px solid #cbd5e1" : "none",
                          background: e.signed_up ? "#fff" : "linear-gradient(135deg, #6366f1, #4f46e5)",
                          color: e.signed_up ? "#475569" : "#fff",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: busy ? "wait" : "pointer",
                          fontFamily: "inherit",
                          opacity: busy ? 0.7 : 1,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {busy ? "…" : e.signed_up ? "Odjavi se" : "Prijavi se"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Supervision;
