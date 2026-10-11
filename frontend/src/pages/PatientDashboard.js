import React, { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

const API = process.env.REACT_APP_API_URL;

async function getToken() {
  const session = await fetchAuthSession();
  return session.tokens?.idToken?.toString();
}

export default function PatientDashboard() {
  const [providers, setProviders] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadProviders(); loadAppointments(); }, []);

  async function loadProviders() {
    const token = await getToken();
    const res = await fetch(`${API}/providers`, { headers: { Authorization: token } });
    const data = await res.json();
    setProviders(data.providers || []);
  }

  async function loadAppointments() {
    const token = await getToken();
    const res = await fetch(`${API}/appointments`, { headers: { Authorization: token } });
    const data = await res.json();
    setAppointments(data.appointments || []);
  }

  async function bookAppointment() {
    if (!selectedProvider || !dateTime) {
      setMessage({ text: "Please select a provider and date/time.", type: "error" });
      return;
    }
    setLoading(true);
    const token = await getToken();
    const res = await fetch(`${API}/appointments`, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      // datetime-local has no timezone, so convert to UTC here (the reminder job works in UTC)
      body: JSON.stringify({ providerId: selectedProvider, dateTime: new Date(dateTime).toISOString() }),
    });
    const data = await res.json();
    setMessage({ text: data.message, type: res.ok ? "success" : "error" });
    setLoading(false);
    loadAppointments();
  }

  async function cancelAppointment(appointmentId) {
    const token = await getToken();
    const res = await fetch(`${API}/appointments/${appointmentId}`, {
      method: "PUT",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const data = await res.json();
    setMessage({ text: data.message, type: res.ok ? "success" : "error" });
    loadAppointments();
  }

  const statusColor = { confirmed: "#10b981", cancelled: "#ef4444", completed: "#f59e0b" };

  return (
    <div>
      <h2 style={styles.pageTitle}>Patient Dashboard</h2>

      {/* Book Appointment */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>📅 Book an Appointment</h3>
        <div style={styles.formRow}>
          <select style={styles.input} value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)}>
            <option value="">Select a provider...</option>
            {providers.map((p) => (
              <option key={p.providerId} value={p.providerId}>
                {p.name} — {p.specialty}
              </option>
            ))}
          </select>
          <input style={styles.input} type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} />
          <button style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }} onClick={bookAppointment} disabled={loading}>
            {loading ? "Booking..." : "Book Appointment"}
          </button>
        </div>
        {message.text && (
          <p style={{ ...styles.message, color: message.type === "success" ? "#10b981" : "#ef4444" }}>
            {message.type === "success" ? "✓ " : "✕ "}{message.text}
          </p>
        )}
      </div>

      {/* My Appointments */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>🗓 My Appointments</h3>
        {appointments.length === 0 ? (
          <p style={styles.emptyText}>No appointments found.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {["Provider", "Date & Time", "Status", "Action"].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.appointmentId} style={styles.tr}>
                  <td style={styles.td}>{a.providerName}</td>
                  <td style={styles.td}>{new Date(a.dateTime).toLocaleString()}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, backgroundColor: (statusColor[a.status] || "#64748b") + "22", color: statusColor[a.status] || "#64748b" }}>
                      {a.status}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {a.status === "confirmed" && (
                      <button style={styles.cancelBtn} onClick={() => cancelAppointment(a.appointmentId)}>
                        Cancel
                      </button>
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
  card: { backgroundColor: "#1e293b", borderRadius: "12px", padding: "24px", marginBottom: "24px", border: "1px solid #334155" },
  cardTitle: { fontSize: "16px", fontWeight: "600", color: "#f1f5f9", marginBottom: "16px" },
  formRow: { display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" },
  input: {
    flex: 1, minWidth: "200px", padding: "10px 14px", backgroundColor: "#0f172a",
    border: "1px solid #334155", borderRadius: "8px", color: "#e2e8f0",
    fontSize: "14px", outline: "none",
  },
  btn: {
    padding: "10px 20px", backgroundColor: "#3b82f6", color: "#fff",
    border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "600",
  },
  cancelBtn: {
    padding: "6px 14px", backgroundColor: "transparent", color: "#ef4444",
    border: "1px solid #ef444466", borderRadius: "6px", cursor: "pointer", fontSize: "13px",
  },
  message: { marginTop: "12px", fontSize: "14px", fontWeight: "500" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "10px 14px", color: "#64748b", fontSize: "12px", fontWeight: "600", borderBottom: "1px solid #334155", textTransform: "uppercase", letterSpacing: "0.5px" },
  tr: { borderBottom: "1px solid #1e293b" },
  td: { padding: "12px 14px", color: "#cbd5e1", fontSize: "14px" },
  badge: { padding: "3px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "600" },
  emptyText: { color: "#64748b", fontSize: "14px" },
};