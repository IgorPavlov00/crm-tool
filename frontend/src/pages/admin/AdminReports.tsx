import React, { useEffect, useState } from "react";
import axios from "axios";
import DateRangePicker from "./DateRangePicker";
import { DateRange, computeRange, rangeQueryParams, rangeLabel } from "./dateRange";
import { backendBase, GENDER_LABELS, cardMeta } from "./adminApi";

interface ReportData {
  period: { start_date: string | null; end_date: string | null };
  cards: Record<string, number>;
  gender_breakdown: { gender: string; count: number }[];
  full_clients_leaderboard: { rank: number; name: string; count: number }[];
  full_sessions_leaderboard: { rank: number; name: string; count: number }[];
  attendance_summary: { meetings_held: number; present: number; absent: number; excused: number };
}

const CARD_LABELS: Record<string, string> = {
  total_therapists: "Ukupno terapeuta",
  active_therapists: "Aktivni terapeuti",
  total_clients: "Ukupno klijenata",
  active_clients: "Aktivni klijenti",
  completed_clients: "Završeni klijenti",
  archived_clients: "Arhivirani klijenti",
  total_sessions: "Ukupno sesija",
  free_sessions: "Besplatne sesije",
  paid_sessions: "Naplaćene sesije",
  female_clients: "Ženski klijenti",
  male_clients: "Muški klijenti",
  other_clients: "Ostalo/nepoznato",
};

const AdminReports: React.FC = () => {
  const [range, setRange] = useState<DateRange>(() => computeRange("current_year"));
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    axios
      .get(`${backendBase}/admin/reports`, { params: rangeQueryParams(range) })
      .then((res) => setData(res.data))
      .catch(() => setError("Greška pri učitavanju izveštaja."))
      .finally(() => setLoading(false));
  }, [range]);

  const handleExportCsv = () => {
    axios
      .get(`${backendBase}/admin/reports/export.csv`, { params: rangeQueryParams(range), responseType: "blob" })
      .then((res) => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `izvestaj_${range.startDate || "sve"}_${range.endDate || "sve"}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch(() => setError("Greška pri izvozu izveštaja."));
  };

  return (
    <div>
      <div className="mhc-page-header no-print">
        <div>
          <h1 className="mhc-page-title">Izveštaji</h1>
          <p className="mhc-page-sub">Kompletan izveštaj centra za izabrani period.</p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      <div className="mhc-toolbar no-print">
        <button type="button" className="mhc-btn mhc-btn-secondary" onClick={handleExportCsv}>
          ⬇ Izvezi CSV
        </button>
        <button type="button" className="mhc-btn mhc-btn-primary" onClick={() => window.print()}>
          🖨 Štampaj izveštaj
        </button>
      </div>

      {error && <div className="mhc-error">{error}</div>}

      {loading ? (
        <div className="mhc-loading">Učitavanje…</div>
      ) : data ? (
        <div id="mhc-report-print">
          <div className="mhc-report-header">
            <div>
              <h2 className="mhc-report-title">Statistika centra</h2>
              <p className="mhc-report-period">{rangeLabel(range)}</p>
            </div>
            <div className="mhc-report-generated">
              Generisano: {new Date().toLocaleString("sr-Latn-RS", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>

          <div className="mhc-cards-grid">
            {Object.entries(CARD_LABELS).map(([key, label]) => {
              const meta = cardMeta(key);
              return (
                <div
                  className="mhc-card"
                  key={key}
                  style={{ "--card-accent": meta.color, "--icon-bg": meta.bg, "--icon-color": meta.color } as React.CSSProperties}
                >
                  <div className="mhc-card-top">
                    <div className="mhc-card-icon">{meta.icon}</div>
                  </div>
                  <div className="mhc-card-label">{label}</div>
                  <div className="mhc-card-value">{data.cards[key] ?? 0}</div>
                </div>
              );
            })}
          </div>

          <div className="mhc-panel-row">
            <div className="mhc-panel-col">
              <div className="mhc-panel">
                <h3 className="mhc-panel-title">Najviše klijenata</h3>
                {data.full_clients_leaderboard.length === 0 ? (
                  <div className="mhc-empty">Nema podataka.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {data.full_clients_leaderboard.map((r) => (
                      <div key={r.rank + r.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className={`mhc-rank-badge${r.rank <= 3 ? ` mhc-rank-${r.rank}` : ""}`}>{r.rank}</span>
                        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "#1e293b" }}>{r.name}</span>
                        <span style={{ fontSize: 12.5, color: "#64748b" }}>{r.count} klijenata</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="mhc-panel-col">
              <div className="mhc-panel">
                <h3 className="mhc-panel-title">Najviše sesija</h3>
                {data.full_sessions_leaderboard.length === 0 ? (
                  <div className="mhc-empty">Nema podataka.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {data.full_sessions_leaderboard.map((r) => (
                      <div key={r.rank + r.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className={`mhc-rank-badge${r.rank <= 3 ? ` mhc-rank-${r.rank}` : ""}`}>{r.rank}</span>
                        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "#1e293b" }}>{r.name}</span>
                        <span style={{ fontSize: 12.5, color: "#64748b" }}>{r.count} sesija</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mhc-panel-row">
            <div className="mhc-panel-col">
              <div className="mhc-panel">
                <h3 className="mhc-panel-title">Polna struktura</h3>
                {data.gender_breakdown.map((g) => (
                  <div key={g.gender} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "4px 0" }}>
                    <span>{GENDER_LABELS[g.gender] || g.gender}</span>
                    <strong>{g.count}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="mhc-panel-col">
              <div className="mhc-panel">
                <h3 className="mhc-panel-title">Prisustvo timu</h3>
                <div style={{ fontSize: 13.5, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div>Sastanaka održano: <strong>{data.attendance_summary.meetings_held}</strong></div>
                  <div>Prisutan: <strong>{data.attendance_summary.present}</strong></div>
                  <div>Odsutan: <strong>{data.attendance_summary.absent}</strong></div>
                  <div>Opravdano odsutan: <strong>{data.attendance_summary.excused}</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        .mhc-report-header {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 20px;
          padding-bottom: 14px;
          border-bottom: 2px solid #eef1f6;
        }
        .mhc-report-title {
          font-family: var(--font-display), Georgia, serif;
          color: #0f172a;
          font-size: 22px;
          font-weight: 700;
          margin: 0 0 4px;
        }
        .mhc-report-period {
          font-size: 13.5px;
          color: #6366f1;
          font-weight: 600;
          margin: 0;
        }
        .mhc-report-generated {
          font-size: 11.5px;
          color: #94a3b8;
        }
        @media print {
          .mhc-sidebar, .no-print { display: none !important; }
          .mhc-main { padding: 0 !important; }
          .mhc-card, .mhc-panel {
            box-shadow: none !important;
            border: 1px solid #e2e8f0 !important;
            break-inside: avoid;
          }
          .mhc-card:hover, .mhc-panel:hover {
            transform: none !important;
          }
          .mhc-panel-row { break-inside: avoid; }
          .mhc-report-header { break-after: avoid; }
          @page { margin: 16mm 12mm; }
        }
      `}</style>
    </div>
  );
};

export default AdminReports;
