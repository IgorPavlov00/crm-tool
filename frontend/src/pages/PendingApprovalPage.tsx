import React from "react";

interface Props {
  email: string;
  onSignOut: () => void;
}

/**
 * Shown instead of the normal app for an account that registered or
 * joined via invite but hasn't been approved by an admin yet - see
 * UserProfile.is_approved on the backend.
 */
const PendingApprovalPage: React.FC<Props> = ({ email, onSignOut }) => {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, #0b1120 0%, #131c31 55%, #0b1120 100%)",
        padding: 20,
        fontFamily: "var(--font-body), 'DM Sans', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 440,
          width: "100%",
          background: "#fff",
          borderRadius: 22,
          padding: "36px 32px",
          textAlign: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "#fef3c7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 18px",
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 22,
            fontWeight: 700,
            color: "#0f172a",
            margin: "0 0 10px",
          }}
        >
          Nalog čeka odobrenje
        </h1>
        <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6, margin: "0 0 4px" }}>
          Vaš nalog (<strong>{email}</strong>) je uspešno registrovan, ali
          mora ga odobriti administrator pre nego što možete da koristite
          aplikaciju.
        </p>
        <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6, margin: "16px 0 24px" }}>
          Kada admin odobri vaš nalog, dobićete email obaveštenje i moći
          ćete da se prijavite.
        </p>
        <button
          onClick={onSignOut}
          style={{
            padding: "10px 22px",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            background: "transparent",
            color: "#64748b",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Odjavi se
        </button>
      </div>
    </div>
  );
};

export default PendingApprovalPage;
