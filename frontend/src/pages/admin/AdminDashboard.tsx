import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import DateRangePicker from "./DateRangePicker";
import { DateRange, computeRange, rangeQueryParams } from "./dateRange";
import { backendBase, GENDER_LABELS, cardMeta } from "./adminApi";

interface DashboardData {
  period: { start_date: string | null; end_date: string | null };
  cards: {
    total_therapists: number;
    active_therapists: number;
    total_clients: number;
    active_clients: number;
    completed_clients: number;
    archived_clients: number;
    total_sessions: number;
    free_sessions: number;
    paid_sessions: number;
    female_clients: number;
    male_clients: number;
    other_clients: number;
  };
  gender_breakdown: { gender: string; count: number }[];
  monthly_sessions: { month: string; count: number }[];
  monthly_new_clients: { month: string; count: number }[];
  sessions_per_therapist: { user_id: number; name: string; count: number }[];
  top_clients_leaderboard: { rank: number; user_id: number; name: string; count: number }[];
  top_sessions_leaderboard: { rank: number; user_id: number; name: string; count: number }[];
}

const PIE_COLORS: Record<string, string> = {
  female: "#ec4899",
  male: "#3b82f6",
  other: "#a855f7",
  unknown: "#94a3b8",
};

const CARD_DEFS: { key: keyof DashboardData["cards"]; label: string }[] = [
  { key: "total_therapists", label: "Ukupno terapeuta" },
  { key: "active_therapists", label: "Aktivni terapeuti" },
  { key: "total_clients", label: "Ukupno klijenata" },
  { key: "active_clients", label: "Aktivni klijenti" },
  { key: "completed_clients", label: "Završeni klijenti" },
  { key: "total_sessions", label: "Ukupno sesija" },
  { key: "free_sessions", label: "Besplatne sesije" },
  { key: "paid_sessions", label: "Naplaćene sesije" },
  { key: "female_clients", label: "Ženski klijenti" },
  { key: "male_clients", label: "Muški klijenti" },
];

const AdminDashboard: React.FC = () => {
  const [range, setRange] = useState<DateRange>(() => computeRange("current_year"));
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    axios
      .get(`${backendBase}/admin/dashboard`, { params: rangeQueryParams(range) })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err?.response?.status === 403
              ? "Nemate ovlašćenje za pristup admin statistici."
              : "Greška pri učitavanju statistike.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  return (
    <div>
      <div className="mhc-page-header">
        <div>
          <h1 className="mhc-page-title">Pregled centra</h1>
          <p className="mhc-page-sub">Statistika se automatski računa iz baze podataka.</p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {error && <div className="mhc-error">{error}</div>}

      {loading ? (
        <div className="mhc-loading">Učitavanje statistike…</div>
      ) : data ? (
        <>
          <div className="mhc-cards-grid">
            {CARD_DEFS.map((c) => {
              const meta = cardMeta(c.key);
              return (
                <div
                  className="mhc-card"
                  key={c.key}
                  style={{ "--card-accent": meta.color } as React.CSSProperties}
                >
                  <div className="mhc-card-label">{c.label}</div>
                  <div className="mhc-card-value">{data.cards[c.key]}</div>
                </div>
              );
            })}
          </div>

          <div className="mhc-panel-row">
            <div className="mhc-panel-col">
              <div className="mhc-panel">
                <h3 className="mhc-panel-title">Najviše klijenata</h3>
                <LeaderboardMini rows={data.top_clients_leaderboard} suffix="klijenata" />
              </div>
            </div>
            <div className="mhc-panel-col">
              <div className="mhc-panel">
                <h3 className="mhc-panel-title">Najviše sesija</h3>
                <LeaderboardMini rows={data.top_sessions_leaderboard} suffix="sesija" />
              </div>
            </div>
          </div>

          <div className="mhc-panel-row">
            <div className="mhc-panel-col">
              <div className="mhc-panel">
                <h3 className="mhc-panel-title">Sesije po mesecima</h3>
                {data.monthly_sessions.length === 0 ? (
                  <div className="mhc-empty">Nema podataka za izabrani period.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={data.monthly_sessions}>
                      <defs>
                        <linearGradient id="mhcSessionsLine" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 10, border: "1px solid #eef1f6", fontSize: 12.5, boxShadow: "0 8px 24px rgba(15,23,42,0.12)" }}
                        cursor={{ stroke: "#c7d2fe", strokeWidth: 1.5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="url(#mhcSessionsLine)"
                        strokeWidth={3}
                        dot={{ r: 3.5, fill: "#6366f1", strokeWidth: 0 }}
                        activeDot={{ r: 5.5 }}
                        name="Sesije"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="mhc-panel-col">
              <div className="mhc-panel">
                <h3 className="mhc-panel-title">Polna struktura klijenata</h3>
                {data.gender_breakdown.length === 0 ? (
                  <div className="mhc-empty">Nema podataka za izabrani period.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={data.gender_breakdown}
                        dataKey="count"
                        nameKey="gender"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={(entry: any) => `${GENDER_LABELS[entry.gender] || entry.gender}: ${entry.count}`}
                      >
                        {data.gender_breakdown.map((g) => (
                          <Cell key={g.gender} fill={PIE_COLORS[g.gender] || "#cbd5e1"} stroke="#fff" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 10, border: "1px solid #eef1f6", fontSize: 12.5, boxShadow: "0 8px 24px rgba(15,23,42,0.12)" }}
                        formatter={(value: any, _name: any, entry: any) => [value, GENDER_LABELS[entry?.payload?.gender] || entry?.payload?.gender]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="mhc-panel">
            <h3 className="mhc-panel-title">Sesije po terapeutu</h3>
            {data.sessions_per_therapist.length === 0 ? (
              <div className="mhc-empty">Nema podataka za izabrani period.</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, data.sessions_per_therapist.length * 36)}>
                <BarChart data={data.sessions_per_therapist} layout="vertical" margin={{ left: 40 }}>
                  <defs>
                    <linearGradient id="mhcBarGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11.5 }} stroke="#94a3b8" axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: "1px solid #eef1f6", fontSize: 12.5, boxShadow: "0 8px 24px rgba(15,23,42,0.12)" }}
                    cursor={{ fill: "#f5f3ff" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12.5 }} />
                  <Bar dataKey="count" name="Sesije" fill="url(#mhcBarGradient)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};

const LeaderboardMini: React.FC<{ rows: { rank: number; name: string; count: number }[]; suffix: string }> = ({ rows, suffix }) => {
  if (rows.length === 0) {
    return <div className="mhc-empty">Nema podataka za izabrani period.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((r) => (
        <div key={r.rank + r.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className={`mhc-rank-badge${r.rank <= 3 ? ` mhc-rank-${r.rank}` : ""}`}>{r.rank}</span>
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "#1e293b" }}>{r.name}</span>
          <span style={{ fontSize: 12.5, color: "#64748b" }}>
            {r.count} {suffix}
          </span>
        </div>
      ))}
    </div>
  );
};

export default AdminDashboard;
