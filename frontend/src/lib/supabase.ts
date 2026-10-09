import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"
  );
}

// Read before createClient() consumes the URL hash: an emailed account
// invitation lands here with "type=invite", and the person still has to
// choose a password before using the app.
// Kept in sessionStorage so it survives the AuthProvider remounting when
// moving between /therapist and /therapist/admin.
export const INVITE_PASSWORD_PENDING_KEY = "invite_password_pending";

try {
  if (typeof window !== "undefined" && /(^|[#&])type=invite(&|$)/.test(window.location.hash)) {
    sessionStorage.setItem(INVITE_PASSWORD_PENDING_KEY, "1");
  }
} catch {
  /* storage unavailable - they can still use "Zaboravljena lozinka" */
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);