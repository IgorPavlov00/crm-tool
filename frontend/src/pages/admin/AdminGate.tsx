import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../contexts/AuthContext";
import AuthPage from "../AuthPage";
import SubscriptionPaywall from "../SubscriptionPaywall";
import AdminArea from "./AdminArea";
import { backendBase } from "./adminApi";

interface SubscriptionInfo {
  status: "trial" | "active" | "expired";
  active: boolean;
  trial_ends_at: string | null;
  subscription_paid_until: string | null;
  payment_instructions: {
    amount_rsd: number;
    bank_account: string;
    recipient: string;
    reference: string;
  };
}

const Spinner: React.FC = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      background: "#0f172a",
    }}
  >
    <svg width="44" height="44" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r="18" fill="none" stroke="#1e293b" strokeWidth="3.5" />
      <circle cx="22" cy="22" r="18" fill="none" stroke="#6366f1" strokeWidth="3.5" strokeDasharray="80 33" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 22 22" to="360 22 22" dur="0.7s" repeatCount="indefinite" />
      </circle>
    </svg>
  </div>
);

const Forbidden: React.FC = () => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      background: "#0f172a",
      color: "#e2e8f0",
      textAlign: "center",
      padding: 24,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}
  >
    <div style={{ fontSize: 52, fontWeight: 700, marginBottom: 10, color: "#818cf8" }}>403</div>
    <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Pristup odbijen</div>
    <p style={{ color: "#94a3b8", maxWidth: 420, fontSize: 14, lineHeight: 1.5 }}>
      Admin centar je dostupan samo administratorima centra. Ako mislite
      da je ovo greška, obratite se administratoru vaše prakse.
    </p>
    <a
      href="/therapist"
      style={{ marginTop: 22, color: "#818cf8", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
    >
      ← Nazad na aplikaciju
    </a>
  </div>
);

/**
 * Client-side gate for /therapist/admin/*. This is a UX convenience only -
 * the real enforcement is server-side: every /admin/* backend endpoint
 * verifies the caller's Supabase token itself and requires is_admin ==
 * true (see require_admin in main_api.py), independent of anything
 * checked here. is_admin is deliberately separate from role
 * (owner/member) - a practicing psychotherapist never gets it just by
 * being a tenant owner or by joining via an invite link.
 */
const AdminGate: React.FC = () => {
  const { user, profile, loading, signOut } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [subLoading, setSubLoading] = useState(true);

  const loadSubscription = useCallback(() => {
    return axios
      .get(`${backendBase}/tenant/subscription`)
      .then((res) => setSubscription(res.data))
      .catch(() => setSubscription(null))
      .finally(() => setSubLoading(false));
  }, []);

  useEffect(() => {
    if (!profile) return;
    loadSubscription();
  }, [profile, loadSubscription]);

  if (loading) return <Spinner />;
  if (!user || !profile) return <AuthPage />;
  if (subLoading) return <Spinner />;

  if (subscription && !subscription.active) {
    return (
      <SubscriptionPaywall
        everPaid={!!subscription.subscription_paid_until}
        payment={subscription.payment_instructions}
        onSignOut={signOut}
      />
    );
  }

  if (!profile.is_admin) return <Forbidden />;

  return <AdminArea />;
};

export default AdminGate;
