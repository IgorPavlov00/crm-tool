import React, { useMemo, useState } from "react";
import axios from "axios";
import { backendBase } from "./adminApi";

interface InviteEntry {
  email: string;
  full_name: string | null;
}

interface InviteResult extends InviteEntry {
  status: "invited" | "already_exists" | "already_has_login" | "email_failed" | "invalid" | "error";
  link?: string | null;
  detail?: string;
}

const STATUS_LABELS: Record<InviteResult["status"], { label: string; bg: string; color: string }> = {
  invited: { label: "Pozvan/a", bg: "#dcfce7", color: "#15803d" },
  already_exists: { label: "Već ima nalog", bg: "#f1f5f9", color: "#64748b" },
  already_has_login: { label: "Već registrovan/a u Supabase", bg: "#fef3c7", color: "#b45309" },
  email_failed: { label: "Email nije poslat", bg: "#fee2e2", color: "#b91c1c" },
  invalid: { label: "Neispravan email", bg: "#fee2e2", color: "#b91c1c" },
  error: { label: "Greška", bg: "#fee2e2", color: "#b91c1c" },
};

// Accepts "Ime Prezime <email>" entries (as copied from an email client),
// separated by commas or new lines, as well as bare email addresses.
export function parseInviteList(text: string): InviteEntry[] {
  const entries: InviteEntry[] = [];
  const pattern = /([^<>,;\n]*?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>|([^\s<>,;]+@[^\s<>,;]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const email = (match[2] || match[3]).trim().toLowerCase();
    const name = (match[1] || "").trim().replace(/^["']|["']$/g, "");
    if (!entries.some((e) => e.email === email)) {
      entries.push({ email, full_name: name || null });
    }
  }
  return entries;
}

const BulkInviteModal: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<InviteResult[] | null>(null);

  const parsed = useMemo(() => parseInviteList(text), [text]);

  const send = () => {
    if (parsed.length === 0) return;
    setSending(true);
    setError("");
    axios
      .post(`${backendBase}/admin/therapists/invite`, { invites: parsed }, { timeout: 300000 })
      .then((res) => {
        setResults(res.data.results);
        onDone();
      })
      .catch((err) => setError(err?.response?.data?.message || "Slanje pozivnica nije uspelo."))
      .finally(() => setSending(false));
  };

  const invitedCount = results?.filter((r) => r.status === "invited").length ?? 0;

  return (
    <div className="mhc-modal-overlay" onClick={() => !sending && onClose()}>
      <div className="mhc-modal" style={{ maxWidth: 640, width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <h3 className="mhc-modal-title">Pozovi više terapeuta</h3>

        {results ? (
          <>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 12px" }}>
              Poslato pozivnica: <strong>{invitedCount}</strong> od {results.length}. Pozvani terapeuti su već odobreni
              i dobiće email sa linkom kojim se automatski prijavljuju.
            </p>
            <div className="mhc-table-wrap" style={{ maxHeight: 380, overflowY: "auto" }}>
              <table className="mhc-table">
                <thead>
                  <tr>
                    <th>Terapeut</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const s = STATUS_LABELS[r.status];
                    return (
                      <tr key={r.email}>
                        <td>
                          {r.full_name || r.email}
                          {r.full_name && (
                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.email}</div>
                          )}
                          {r.link && (
                            <input
                              readOnly
                              className="mhc-input"
                              style={{ marginTop: 6, fontSize: 11, width: "100%" }}
                              value={r.link}
                              onFocus={(e) => e.target.select()}
                              title="Pošaljite ovaj link ručno"
                            />
                          )}
                        </td>
                        <td>
                          <span className="mhc-badge" style={{ background: s.bg, color: s.color, whiteSpace: "nowrap" }}>
                            {s.label}
                          </span>
                          {r.detail && (
                            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4, maxWidth: 260 }}>
                              {r.detail}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mhc-modal-actions">
              <button type="button" className="mhc-btn mhc-btn-primary" onClick={onClose}>
                Gotovo
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 12px" }}>
              Nalepite listu, npr. <code>Ime Prezime &lt;email@primer.com&gt;</code>, odvojeno zarezom ili novim redom.
              Svako dobija email sa linkom kojim potvrđuje nalog i automatski se prijavljuje, a nalog je odmah odobren.
            </p>
            <textarea
              className="mhc-input"
              rows={9}
              style={{ width: "100%", fontFamily: "inherit", resize: "vertical" }}
              placeholder={"Ana Anić <ana@primer.com>,\nMarko Marković <marko@primer.com>"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={sending}
            />
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "8px 0 0" }}>
              Prepoznato osoba: {parsed.length}
            </div>
            {error && <div className="mhc-error" style={{ marginTop: 12 }}>{error}</div>}
            <div className="mhc-modal-actions">
              <button type="button" className="mhc-btn mhc-btn-secondary" onClick={onClose} disabled={sending}>
                Otkaži
              </button>
              <button
                type="button"
                className="mhc-btn mhc-btn-primary"
                onClick={send}
                disabled={sending || parsed.length === 0}
              >
                {sending ? "Slanje…" : `Pošalji pozivnice (${parsed.length})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BulkInviteModal;
