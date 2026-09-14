import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import HomeLink from "../components/HomeLink";

/**
 * Shown right after following a password-reset email link, before the
 * normal app - lets the person set a new password, including accounts
 * that originally signed up via Google (which never had one).
 */
const ResetPasswordPage: React.FC = () => {
  const { updatePassword, clearPasswordRecovery, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Lozinka mora imati najmanje 6 karaktera");
      return;
    }
    if (password !== confirmPassword) {
      setError("Lozinke se ne poklapaju");
      return;
    }

    setLoading(true);
    const result = await updatePassword(password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  };

  return (
    <div className="auth-container">
      <HomeLink />
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6366f1"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <h1 className="auth-title">Postavite lozinku</h1>
          <p className="auth-subtitle">
            {done
              ? "Lozinka je postavljena."
              : "Unesite novu lozinku za prijavu putem email-a i lozinke."}
          </p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {done ? (
          <button
            type="button"
            className="auth-btn auth-btn-primary"
            onClick={() => {
              clearPasswordRecovery();
            }}
          >
            Nastavi
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label>Nova lozinka</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <div className="auth-field">
              <label>Potvrdite lozinku</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              className="auth-btn auth-btn-primary"
              disabled={loading}
            >
              {loading ? "Čuvanje..." : "Sačuvaj lozinku"}
            </button>
          </form>
        )}

        <div className="auth-toggle">
          <p>
            <button type="button" onClick={() => signOut()}>
              Odjavi se
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
