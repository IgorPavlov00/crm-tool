export const backendBase = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface Therapist {
  user_id: number;
  full_name: string | null;
  email: string;
  role: string;
  active: boolean;
  total_clients: number;
  active_clients: number;
  completed_clients: number;
  clients_in_range: number;
  total_sessions: number;
  sessions_in_range: number;
  free_sessions_in_range: number;
  clients_rank_in_range?: number;
  sessions_rank_in_range?: number;
  clients_rank_overall?: number;
  sessions_rank_overall?: number;
}

export interface Client {
  id: number;
  ime: string;
  prezime: string;
  email: string | null;
  broj_telefona: string | null;
  gender: string | null;
  status: "active" | "completed" | "archived";
  therapist_id: number | null;
  therapist_name: string | null;
  date_started: string | null;
  date_completed: string | null;
  created_at: string | null;
  updated_at: string | null;
  session_count?: number;
}

export interface SessionRow {
  id: number;
  klijent_id: number | null;
  klijent_name: string | null;
  therapist_id: number | null;
  therapist_name: string | null;
  pocetak: string;
  kraj: string | null;
  status: string;
  cena: number;
  is_free: boolean | null;
  session_number: number | null;
}

export interface LeaderboardRow {
  rank: number;
  user_id: number;
  name: string;
  count: number;
}

export const GENDER_LABELS: Record<string, string> = {
  female: "Žensko",
  male: "Muško",
  other: "Drugo",
  unknown: "Nepoznato",
};

export const STATUS_LABELS: Record<string, string> = {
  active: "Aktivan",
  completed: "Završen",
  archived: "Arhiviran",
};

export const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active: { bg: "#dcfce7", color: "#15803d" },
  completed: { bg: "#dbeafe", color: "#1e40af" },
  archived: { bg: "#f1f5f9", color: "#64748b" },
};

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("sr-Latn-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function therapistDisplayName(t: { full_name: string | null; email: string } | null | undefined): string {
  if (!t) return "—";
  return t.full_name || t.email;
}
