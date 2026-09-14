import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import DateRangePicker from "./DateRangePicker";
import { DateRange, computeRange, rangeQueryParams } from "./dateRange";
import { backendBase } from "./adminApi";
import AnimatedNumber from "./AnimatedNumber";
import "./AdminDashboard.css";

interface NamedCount {
  user_id: number;
  name: string;
  count: number;
}

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
  clients_per_therapist: NamedCount[];
  sessions_per_therapist: NamedCount[];
  top_clients_leaderboard: { rank: number; user_id: number; name: string; count: number }[];
  top_sessions_leaderboard: { rank: number; user_id: number; name: string; count: number }[];
}

const WarningIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const ChartEmptyIcon: React.FC = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="20" x2="4" y2="12" />
    <line x1="10" y1="20" x2="10" y2="7" />
    <line x1="16" y1="20" x2="16" y2="14" />
    <line x1="2" y1="20" x2="22" y2="20" />
  </svg>
);

function findDuplicateTherapistNames(data: DashboardData): string[] {
  const byId = new Map<number, string>();
  [...data.sessions_per_therapist, ...(data.clients_per_therapist || [])].forEach((t) => {
    if (t.name && t.name !== "—" && !byId.has(t.user_id)) {
      byId.set(t.user_id, t.name);
    }
  });
  const byLowerName = new Map<string, { name: string; user_id: number }[]>();
  byId.forEach((name, user_id) => {
    const key = name.trim().toLowerCase();
    const group = byLowerName.get(key) || [];
    group.push({ name, user_id });
    byLowerName.set(key, group);
  });
  const messages: string[] = [];
  byLowerName.forEach((group) => {
    if (group.length < 2) return;
    const variants = Array.from(new Set(group.map((g) => g.name)));
    if (variants.length > 1) {
      const label = variants.map((v) => `"${v}"`).join(" i ");
      messages.push(`${label} su isti čovek i trenutno mu se statistika deli na ${group.length} reda.`);
    } else {
      messages.push(`"${variants[0]}" se pojavljuje na ${group.length} različita naloga i trenutno mu se statistika deli.`);
    }
  });
  return messages;
}

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

  const duplicateWarnings = useMemo(() => (data ? findDuplicateTherapistNames(data) : []), [data]);

  return (
    <div className="dash-root">
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
          <KpiCards data={data} />

          {duplicateWarnings.length > 0 && (
            <div className="dash-warning">
              <WarningIcon />
              <div className="dash-warning-lines">
                {duplicateWarnings.map((msg) => (
                  <span key={msg}>{msg}</span>
                ))}
              </div>
            </div>
          )}

          <div className="dash-panel-row">
            <div className="dash-panel-col">
              <div className="dash-panel">
                <h3 className="dash-panel-title">Najviše klijenata</h3>
                <LeaderboardRows rows={data.top_clients_leaderboard} />
              </div>
            </div>
            <div className="dash-panel-col">
              <div className="dash-panel">
                <h3 className="dash-panel-title">Najviše sesija</h3>
                <LeaderboardRows rows={data.top_sessions_leaderboard} />
              </div>
            </div>
          </div>

          <div className="dash-panel-row">
            <div className="dash-panel-col">
              <div className="dash-panel">
                <h3 className="dash-panel-title">Sesije po mesecima</h3>
                <MonthlySessionsChart monthly={data.monthly_sessions} />
              </div>
            </div>
            <div className="dash-panel-col">
              <div className="dash-panel">
                <h3 className="dash-panel-title">Polna struktura</h3>
                <GenderStackedBar cards={data.cards} />
              </div>
            </div>
          </div>

          <div className="dash-panel">
            <h3 className="dash-panel-title">Sesije po terapeutu</h3>
            <SessionsPerTherapistBars rows={data.sessions_per_therapist} />
          </div>
        </>
      ) : null}
    </div>
  );
};

const KpiCards: React.FC<{ data: DashboardData }> = ({ data }) => {
  const { cards, sessions_per_therapist } = data;
  const therapistsWithSessions = sessions_per_therapist.length;
  const sessionsPerClient = cards.total_clients > 0 ? cards.total_sessions / cards.total_clients : 0;
  const paidPct = cards.total_sessions > 0 ? Math.round((cards.paid_sessions / cards.total_sessions) * 100) : 0;
  const therapistsSub =
    cards.total_therapists > 0 && cards.active_therapists === cards.total_therapists
      ? "svi aktivni"
      : `${cards.active_therapists} aktivnih`;

  const kpis = [
    {
      key: "clients",
      label: "Klijenti",
      value: cards.total_clients,
      sub: `${cards.active_clients} aktivnih · ${cards.completed_clients} završenih`,
    },
    {
      key: "therapists",
      label: "Terapeuti",
      value: cards.total_therapists,
      sub: `${therapistsSub} · ${therapistsWithSessions} sa sesijama`,
    },
    {
      key: "sessions",
      label: "Sesije",
      value: cards.total_sessions,
      sub: `${sessionsPerClient.toFixed(1)} po klijentu`,
    },
    {
      key: "paid",
      label: "Naplaćene sesije",
      value: cards.paid_sessions,
      sub: `${paidPct}% od ukupnih`,
    },
  ];

  return (
    <div className="dash-cards">
      {kpis.map((k) => (
        <div className="dash-kpi" key={k.key}>
          <div className="dash-kpi-label">{k.label}</div>
          <div className="dash-kpi-value">
            <AnimatedNumber value={k.value} />
          </div>
          <div className="dash-kpi-sub">{k.sub}</div>
        </div>
      ))}
    </div>
  );
};

const LeaderboardRows: React.FC<{ rows: { rank: number; name: string; count: number }[] }> = ({ rows }) => {
  if (rows.length === 0) {
    return <div className="dash-empty">Nema podataka za izabrani period.</div>;
  }
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div>
      {rows.map((r) => (
        <div className="dash-lb-row" key={r.rank + r.name}>
          <span className="dash-lb-rank">{r.rank}.</span>
          <span className="dash-lb-name">{r.name}</span>
          <span className="dash-lb-track">
            <span className="dash-lb-fill" style={{ width: `${(r.count / max) * 100}%` }} />
          </span>
          <span className="dash-lb-count">{r.count}</span>
        </div>
      ))}
    </div>
  );
};

const GENDER_SEGMENTS: { key: "female" | "male" | "unknown"; label: string; color: string }[] = [
  { key: "female", label: "Žensko", color: "var(--dash-female)" },
  { key: "male", label: "Muško", color: "var(--dash-accent)" },
  { key: "unknown", label: "Nepoznato", color: "var(--dash-unknown)" },
];

const GenderStackedBar: React.FC<{ cards: DashboardData["cards"] }> = ({ cards }) => {
  const counts: Record<string, number> = {
    female: cards.female_clients,
    male: cards.male_clients,
    unknown: cards.other_clients,
  };
  const total = counts.female + counts.male + counts.unknown;

  if (total === 0) {
    return <div className="dash-empty">Nema podataka za izabrani period.</div>;
  }

  return (
    <div>
      <div className="dash-stack-bar">
        {GENDER_SEGMENTS.map((seg) => (
          <span
            key={seg.key}
            className="dash-stack-seg"
            style={{ flex: `${counts[seg.key]} 0 0`, background: seg.color }}
          />
        ))}
      </div>
      <div className="dash-legend">
        {GENDER_SEGMENTS.map((seg) => {
          const count = counts[seg.key];
          const pct = Math.round((count / total) * 100);
          return (
            <div className="dash-legend-item" key={seg.key}>
              <span className="dash-legend-dot" style={{ background: seg.color }} />
              {seg.label}: <span className="dash-legend-value">{count} · {pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SessionsPerTherapistBars: React.FC<{ rows: NamedCount[] }> = ({ rows }) => {
  if (rows.length === 0) {
    return <div className="dash-empty">Nema podataka za izabrani period.</div>;
  }
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="dash-bars-block">
      {rows.map((r) => (
        <div className="dash-bar-row" key={r.user_id}>
          <span className="dash-bar-name">{r.name}</span>
          <span className="dash-bar-track">
            <span className="dash-bar-fill" style={{ width: `${(r.count / max) * 100}%` }} />
          </span>
          <span className="dash-bar-value">{r.count}</span>
        </div>
      ))}
    </div>
  );
};

const MonthlySessionsChart: React.FC<{ monthly: { month: string; count: number }[] }> = ({ monthly }) => {
  if (monthly.length < 2) {
    return (
      <div className="dash-chart-empty">
        <ChartEmptyIcon />
        {monthly.length === 1 ? (
          <>
            <div className="dash-chart-empty-title">Samo jedan mesec sa podacima ({monthly[0].month})</div>
            <div className="dash-chart-empty-sub">Trend se prikazuje od drugog meseca</div>
          </>
        ) : (
          <div className="dash-chart-empty-title">Nema podataka za izabrani period</div>
        )}
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={monthly}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e5e9" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#8a94a1" axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#8a94a1" axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e5e9", fontSize: 12.5 }} />
        <Line type="monotone" dataKey="count" stroke="#2a78d6" strokeWidth={2} dot={{ r: 3, fill: "#2a78d6", strokeWidth: 0 }} activeDot={{ r: 5 }} name="Sesije" />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default AdminDashboard;
