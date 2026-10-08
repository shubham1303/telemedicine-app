import React, { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

const API = process.env.REACT_APP_API_URL;

async function getToken() {
  const session = await fetchAuthSession();
  return session.tokens?.idToken?.toString();
}

export default function ProviderDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [message, setMessage] = useState({ text: "", type: "" });

  useEffect(() => { loadAppointments(); }, []);

  async function loadAppointments() {
    const token = await getToken();
    const res = await fetch(`${API}/appointments`, { headers: { Authorization: token } });
    const data = await res.json();
    setAppointments(data.appointments || []);
  }

  async function updateStatus(appointmentId, status) {
    const token = await getToken();
    const res = await fetch(`${API}/appointments/${appointmentId}`, {
      method: "PUT",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", status }),
    });
    const data = await res.json();
    setMessage({ text: data.message, type: res.ok ? "success" : "error" });
    loadAppointments();
  }

  const statusColor = { confirmed: "#10b981", cancelled: "#ef4444", completed: "#f59e0b" };
  const confirmed = appointments.filter(a => a.status === "confirmed");
  const others = appointments.filter(a => a.status !== "confirmed");

  return (
    <div>
      <h2 style={styles.pageTitle}>Provider Dashboard</h2>

      {/* Stats row */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <p style={styles.statNum}>{appointments.length}</p>
          <p style={styles.statLabel}>Total Appointments</p>
        </div>
        <div style={styles.statCard}>
          <p style={{ ...styles.statNum, color: "#10b981" }}>{confirmed.length}</p>
          <p style={styles.statLabel}>Upcoming</p>
        </div>
        <div style={styles.statCard}>
          <p style={{ ...styles.statNum, color: "#f59e0b" }}>{others.length}</p>
          <p style={styles.statLabel}>Completed / Cancelled</p>
        </div>
      </div>

      {message.text && (
        <p style={{ ...styles.message, color: message.type === "success" ? "#10b981" : "#ef4444" }}>
          {message.type === "success" ? "✓ " : "✕ "}{message.text}
        </p>
      )}

      <div style={styles.card}>
        <h3 style={styles.cardTitle}>🗓 My Appointments</h3>
        {appointments.length === 0 ? (
          <p style={styles.emptyText}>No appointments found.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {["Patient Email", "Date & Time", "Status", "Actions"].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.appointmentId} style={styles.tr}>
                  <td style={styles.td}>{a.patientEmail}</td>
                  <td style={styles.td}>{new Date(a.dateTime).toLocaleString()}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, backgroundColor: (statusColor[a.status] || "#64748b") + "22", color: statusColor[a.status] || "#64748b" }}>
                      {a.status}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {a.status === "confirmed" && (
                      <div style={styles.actionRow}>
                        <button style={styles.completeBtn} onClick={() => updateStatus(a.appointmentId, "completed")}>
                          ✓ Complete
                        </button>
                        <button style={styles.cancelBtn} onClick={() => updateStatus(a.appointmentId, "cancelled")}>
                          ✕ Cancel
                        </button>
                      </div>
                    )}
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
  message: { fontSize: "14px", fontWeight: "500", marginBottom: "16px" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "10px 14px", color: "#64748b", fontSize: "12px", fontWeight: "600", borderBottom: "1px solid #334155", textTransform: "uppercase", letterSpacing: "0.5px" },
  tr: { borderBottom: "1px solid #334155" },
  td: { padding: "12px 14px", color: "#cbd5e1", fontSize: "14px" },
  badge: { padding: "3px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "600" },
  actionRow: { display: "flex", gap: "8px" },
  completeBtn: { padding: "6px 14px", backgroundColor: "transparent", color: "#10b981", border: "1px solid #10b98166", borderRadius: "6px", cursor: "pointer", fontSize: "13px" },
  cancelBtn: { padding: "6px 14px", backgroundColor: "transparent", color: "#ef4444", border: "1px solid #ef444466", borderRadius: "6px", cursor: "pointer", fontSize: "13px" },
  emptyText: { color: "#64748b", fontSize: "14px" },
};