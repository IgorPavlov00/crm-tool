import React from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import AdminDashboard from "./AdminDashboard";
import AdminTherapists from "./AdminTherapists";
import AdminTherapistDetail from "./AdminTherapistDetail";
import AdminClients from "./AdminClients";
import AdminClientDetail from "./AdminClientDetail";
import AdminSessions from "./AdminSessions";
import AdminTeamAttendance from "./AdminTeamAttendance";
import AdminReports from "./AdminReports";
import "./AdminArea.css";

const NAV_ITEMS = [
  { to: "dashboard", label: "Pregled", icon: "▦" },
  { to: "clients", label: "Klijenti", icon: "▤" },
  { to: "therapists", label: "Terapeuti", icon: "⚕" },
  { to: "sessions", label: "Sesije", icon: "◷" },
  { to: "team-attendance", label: "Prisustvo tima", icon: "✓" },
  { to: "reports", label: "Izveštaji", icon: "☷" },
];

const initials = (name: string | null | undefined): string => {
  if (!name) return "A";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const AdminArea: React.FC = () => {
  const { profile } = useAuth();

  return (
    <div className="mhc-shell">
      <nav className="mhc-sidebar">
        <div className="mhc-sidebar-header">
          <div className="mhc-sidebar-avatar">{initials(profile?.tenant_name)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="mhc-sidebar-title">Admin centar</div>
            <div className="mhc-sidebar-sub">{profile?.tenant_name}</div>
          </div>
        </div>
        <div className="mhc-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `mhc-nav-item ${isActive ? "active" : ""}`}
            >
              <span className="mhc-nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
        <a href="/therapist" className="mhc-back-link">
          ← Nazad na aplikaciju
        </a>
      </nav>
      <main className="mhc-main">
        <Routes>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="clients" element={<AdminClients />} />
          <Route path="clients/:clientId" element={<AdminClientDetail />} />
          <Route path="therapists" element={<AdminTherapists />} />
          <Route path="therapists/:therapistId" element={<AdminTherapistDetail />} />
          <Route path="sessions" element={<AdminSessions />} />
          <Route path="team-attendance" element={<AdminTeamAttendance />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export default AdminArea;
