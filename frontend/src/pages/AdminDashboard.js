import React, { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

const API = process.env.REACT_APP_API_URL;

async function getToken() {
  const session = await fetchAuthSession();
  return session.tokens?.idToken?.toString();
}

export default function AdminDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [providers, setProviders] = useState([]);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [newProvider, setNewProvider] = useState({ username: "", name: "", specialty: "", email: "" });

  useEffect(() => { loadAppointments(); loadProviders(); }, []);

  async function loadAppointments() {
    const token = await getToken();
    const res = await fetch(`${API}/appointments`, { headers: { Authorization: token } });
    const data = await res.json();
    setAppointments(data.appointments || []);
  }

  async function loadProviders() {
    const token = await getToken();
    const res = await fetch(`${API}/providers`, { headers: { Authorization: token } });
    const data = await res.json();
    setProviders(data.providers || []);
  }

  async function createProvider() {
    const { username, name, specialty, email } = newProvider;
    if (!username || !name || !specialty || !email) {
      setMessage({ text: "All fields are required.", type: "error" });
      return;
    }
    const token = await getToken();
    const res = await fetch(`${API}/providers`, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify(newProvider),
    });
    const data = await res.json();
    setMessage({ text: data.message, type: res.ok ? "success" : "error" });
    setNewProvider({ username: "", name: "", specialty: "", email: "" });
    loadProviders();
  }

  async function deactivateProvider(providerId) {
    const token = await getToken();
    const res = await fetch(`${API}/providers/${providerId}`, {
      method: "DELETE",
      headers: { Authorization: token },
    });
    const data = await res.json();
    setMessage({ text: data.message, type: res.ok ? "success" : "error" });
    loadProviders();
  }

  const statusColor = { confirmed: "#10b981", cancelled: "#ef4444", completed: "#f59e0b" };
  const fields = ["username", "name", "specialty", "email"];
  const placeholders = {
    username: "User Email (Cognito login email)",
    name: "Display Name (e.g. Dr. John Smith)",
    specialty: "Specialty (e.g. Cardiology)",
    email: "Contact Email (for notifications)"
  };

  return (
    <div>
      <h2 style={styles.pageTitle}>Admin Dashboard</h2>

      {/* Stats */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <p style={styles.statNum}>{appointments.length}</p>
          <p style={styles.statLabel}>Total Appointments</p>
        </div>
        <div style={styles.statCard}>
          <p style={{ ...styles.statNum, color: "#10b981" }}>{providers.filter(p => p.active).length}</p>
          <p style={styles.statLabel}>Active Providers</p>
        </div>
        <div style={styles.statCard}>
          <p style={{ ...styles.statNum, color: "#3b82f6" }}>{appointments.filter(a => a.status === "confirmed").length}</p>
          <p style={styles.statLabel}>Upcoming Appointments</p>
        </div>
      </div>

      {message.text && (
        <p style={{ ...styles.message, color: message.type === "success" ? "#10b981" : "#ef4444" }}>
          {message.type === "success" ? "✓ " : "✕ "}{message.text}
        </p>
      )}

      {/* Promote User to Provider */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>👤 Promote User to Provider</h3>
        <div style={styles.formGrid}>
          {fields.map((field) => (
            <input
              key={field}
              style={styles.input}
              placeholder={placeholders[field]}
              value={newProvider[field]}
              onChange={(e) => setNewProvider({ ...newProvider, [field]: e.target.value })}
            />
          ))}
        </div>
        <button style={styles.btn} onClick={createProvider}>Create Provider</button>
      </div>

      {/* All Providers */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>🩺 All Providers</h3>
        {providers.length === 0 ? (
          <p style={styles.emptyText}>No providers found.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {["Name", "Specialty", "Email", "Status", "Action"].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.providerId} style={styles.tr}>
                  <td style={styles.td}>{p.name}</td>
                  <td style={styles.td}>{p.specialty}</td>
                  <td style={styles.td}>{p.email}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, backgroundColor: p.active ? "#10b98122" : "#ef444422", color: p.active ? "#10b981" : "#ef4444" }}>
                      {p.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {p.active && (
                      <button style={styles.deactivateBtn} onClick={() => deactivateProvider(p.providerId)}>
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* All Appointments */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>🗓 All Appointments</h3>
        {appointments.length === 0 ? (
          <p style={styles.emptyText}>No appointments found.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {["Patient", "Provider", "Date & Time", "Status"].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.appointmentId} style={styles.tr}>
                  <td style={styles.td}>{a.patientEmail}</td>
                  <td style={styles.td}>{a.providerName}</td>
                  <td style={styles.td}>{new Date(a.dateTime).toLocaleString()}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, backgroundColor: (statusColor[a.status] || "#64748b") + "22", color: statusColor[a.status] || "#64748b" }}>
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const styles = {
  pageTitle: { fontSize: "24px", fontWeight: "700", color: "#f1f5f9", marginBottom: "24px" },
  statsRow: { display: "flex", gap: "16px", marginBottom: "24px", flexWrap: "wrap" },
  statCard: { flex: 1, minWidth: "140px", backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "20px", textAlign: "center" },
  statNum: { fontSize: "32px", fontWeight: "700", color: "#f1f5f9", margin: "0 0 4px" },
  statLabel: { fontSize: "13px", color: "#64748b", margin: 0 },
  card: { backgroundColor: "#1e293b", borderRadius: "12px", padding: "24px", marginBottom: "24px", border: "1px solid #334155" },
  cardTitle: { fontSize: "16px", fontWeight: "600", color: "#f1f5f9", marginBottom: "16px" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" },
  input: { padding: "10px 14px", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", color: "#e2e8f0", fontSize: "14px", outline: "none" },
  btn: { padding: "10px 20px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "600" },
  deactivateBtn: { padding: "6px 14px", backgroundColor: "transparent", color: "#ef4444", border: "1px solid #ef444466", borderRadius: "6px", cursor: "pointer", fontSize: "13px" },
  message: { fontSize: "14px", fontWeight: "500", marginBottom: "16px" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "10px 14px", color: "#64748b", fontSize: "12px", fontWeight: "600", borderBottom: "1px solid #334155", textTransform: "uppercase", letterSpacing: "0.5px" },
  tr: { borderBottom: "1px solid #334155" },
  td: { padding: "12px 14px", color: "#cbd5e1", fontSize: "14px" },
  badge: { padding: "3px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "600" },
  emptyText: { color: "#64748b", fontSize: "14px" },
};