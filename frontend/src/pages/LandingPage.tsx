import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, type Variants } from "framer-motion";

const injectStyles = () => {
  if (document.getElementById("landing-split-styles")) return;
  const s = document.createElement("style");
  s.id = "landing-split-styles";
  s.textContent = `
    .lp-split { display: flex; min-height: 100vh; }
    .lp-left { flex: 1 1 480px; max-width: 560px; }
    .lp-right { flex: 1 1 55%; }
    @media (max-width: 880px) {
      .lp-right { display: none; }
      .lp-left { flex: 1 1 auto; max-width: 100%; }
    }
  `;
  document.head.appendChild(s);
};

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
  },
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    injectStyles();
  }, []);

  return (
    <div className="lp-split">
      {/* ============ LEFT: WHITE PANEL ============ */}
      <div
        className="lp-left"
        style={{
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "44px clamp(28px, 6vw, 72px)",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "linear-gradient(135deg, #6366f1, #7c3aed)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <div
              style={{
                fontFamily: "var(--font-display), Georgia, serif",
                fontSize: 18,
                fontWeight: 600,
                color: "#0f172a",
                lineHeight: 1.1,
              }}
            >
              PsihoApp
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>
              Terapeuti i klijenti, na jednom mestu
            </div>
          </div>
        </div>

        {/* Middle content */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          style={{ maxWidth: 420, margin: "56px 0" }}
        >
          <motion.h1
            variants={item}
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "clamp(32px, 5vw, 44px)",
              fontWeight: 600,
              color: "#0f172a",
              margin: "0 0 14px",
              letterSpacing: "-0.5px",
              lineHeight: 1.1,
            }}
          >
            Dobrodošli
          </motion.h1>

          <motion.p
            variants={item}
            style={{
              fontSize: 16,
              color: "#64748b",
              lineHeight: 1.6,
              margin: "0 0 36px",
            }}
          >
            Pronađite pravu podršku ili upravljajte svojom praksom, sve na
            jednom mestu.
          </motion.p>

          <motion.div
            variants={item}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <motion.button
              whileHover={{
                y: -3,
                boxShadow: "0 16px 32px rgba(99,102,241,0.22)",
              }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/therapist")}
              style={optionCardStyle}
            >
              <div style={{ ...optionIconWrap, background: "#eef2ff" }}>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div style={{ flex: 1, textAlign: "left" }}>
                <div style={optionTitle}>Ja sam terapeut</div>
                <div style={optionBody}>
                  Prijavite se i vodite svoju praksu
                </div>
              </div>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#6366f1"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </motion.button>

            <motion.button
              whileHover={{
                y: -3,
                boxShadow: "0 16px 32px rgba(22,163,74,0.2)",
              }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/find-therapist")}
              style={optionCardStyle}
            >
              <div style={{ ...optionIconWrap, background: "#f0fdf4" }}>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div style={{ flex: 1, textAlign: "left" }}>
                <div style={optionTitle}>Tražim podršku</div>
                <div style={optionBody}>
                  Pronađite terapeuta i zakažite termin
                </div>
              </div>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#16a34a"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </motion.button>
          </motion.div>

          <motion.p
            variants={item}
            style={{
              textAlign: "center",
              fontSize: 13,
              color: "#94a3b8",
              margin: "24px 0 0",
            }}
          >
            Već imate nalog?{" "}
            <button
              onClick={() => navigate("/client")}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "#6366f1",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
                textDecoration: "underline",
                textUnderlineOffset: "2px",
              }}
            >
              Prijavite se
            </button>
          </motion.p>
        </motion.div>

        <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
          © 2026 PsihoApp
        </p>
      </div>

      {/* ============ RIGHT: GRADIENT PANEL ============ */}
      <div
        className="lp-right"
        style={{
          position: "relative",
          overflow: "hidden",
          background:
            "linear-gradient(160deg, #4f46e5 0%, #7c3aed 55%, #6d28d9 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 48px",
        }}
      >
        {/* Soft floating circles */}
        <div
          className="glow-orb drift-a"
          style={{
            width: 340,
            height: 340,
            background: "radial-gradient(circle, rgba(255,255,255,0.5), transparent 70%)",
            top: "-6%",
            left: "-8%",
            opacity: 0.35,
          }}
        />
        <div
          className="glow-orb drift-b"
          style={{
            width: 260,
            height: 260,
            background: "radial-gradient(circle, rgba(196,181,253,0.6), transparent 70%)",
            bottom: "-4%",
            right: "-6%",
            opacity: 0.4,
          }}
        />
        <div
          className="glow-orb"
          style={{
            width: 200,
            height: 200,
            background: "radial-gradient(circle, rgba(255,255,255,0.4), transparent 70%)",
            top: "40%",
            right: "18%",
            opacity: 0.25,
          }}
        />

        {/* Floating UI preview cards */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: [0, -8, 0] }}
          transition={{
            opacity: { duration: 0.6, delay: 0.3 },
            y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.3 },
          }}
          style={{ ...floatCard, top: "10%", left: "6%", width: 190 }}
        >
          <div style={floatLabel}>Sledeća sesija</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "#eef2ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Ana K.</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Danas u 14:00</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: [0, -10, 0] }}
          transition={{
            opacity: { duration: 0.6, delay: 0.5 },
            y: { duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.6 },
          }}
          style={{ ...floatCard, top: "58%", left: "2%", width: 210 }}
        >
          <div style={floatLabel}>Pronalazimo najbolji fit</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            <span style={{ ...chip, background: "#ecfdf5", color: "#16a34a", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Anksioznost
            </span>
            <span style={chip}>Tuga</span>
            <span style={chip}>Veze</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: [0, -9, 0] }}
          transition={{
            opacity: { duration: 0.6, delay: 0.7 },
            y: { duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 0.9 },
          }}
          style={{ ...floatCard, top: "16%", right: "4%", width: 168 }}
        >
          <div style={floatLabel}>Aktivni klijenti</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: "#16a34a", fontFamily: "var(--font-display), Georgia, serif" }}>
              +24
            </span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>ovog meseca</span>
          </div>
        </motion.div>

        {/* Headline + checklist */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: "relative", zIndex: 1, maxWidth: 440, textAlign: "center" }}
        >
          <h2
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: "clamp(26px, 3.4vw, 34px)",
              fontWeight: 600,
              color: "#fff",
              margin: "0 0 24px",
              lineHeight: 1.2,
              letterSpacing: "-0.3px",
            }}
          >
            Sve na jednom mestu — za terapeute i klijente
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "left" }}>
            {[
              "Vodite kalendar, klijente i grupe bez glavobolje",
              "Pronađite terapeuta koji vam odgovara",
              "Automatski podsetnici i online zakazivanje",
            ].map((text) => (
              <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.18)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span style={{ fontSize: 14.5, color: "rgba(255,255,255,0.92)", lineHeight: 1.5 }}>
                  {text}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const optionCardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  width: "100%",
  padding: "18px 20px",
  border: "1.5px solid #eef0f6",
  borderRadius: 16,
  background: "#fff",
  cursor: "pointer",
  fontFamily: "inherit",
  boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
};

const optionIconWrap: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const optionTitle: React.CSSProperties = {
  fontFamily: "var(--font-display), Georgia, serif",
  fontSize: 16,
  fontWeight: 600,
  color: "#0f172a",
};

const optionBody: React.CSSProperties = {
  fontSize: 12.5,
  color: "#94a3b8",
  marginTop: 2,
};

const floatCard: React.CSSProperties = {
  position: "absolute",
  zIndex: 1,
  background: "rgba(255,255,255,0.97)",
  borderRadius: 14,
  padding: "12px 14px",
  boxShadow: "0 16px 36px rgba(30,10,80,0.28)",
};

const floatLabel: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.4px",
};

const chip: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  padding: "3px 9px",
  borderRadius: 20,
  background: "#f1f5f9",
  color: "#64748b",
};

export default LandingPage;
