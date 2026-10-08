import React, { useEffect, useState } from "react";
import { fetchAuthSession, signOut } from "aws-amplify/auth";
import { withAuthenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";

import PatientDashboard from "./pages/PatientDashboard";
import ProviderDashboard from "./pages/ProviderDashboard";
import AdminDashboard from "./pages/AdminDashboard";

function App() {
  const [userGroup, setUserGroup] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getUserGroup() {
      try {
        const session = await fetchAuthSession();
        const groups = session.tokens?.idToken?.payload["cognito:groups"] || [];
        if (groups.includes("Admins")) setUserGroup("Admins");
        else if (groups.includes("Providers")) setUserGroup("Providers");
        else setUserGroup("Patients");
      } catch (err) {
        console.error("Error fetching session", err);
      } finally {
        setLoading(false);
      }
    }
    getUserGroup();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    window.location.reload();
  };

  if (loading) return (
    <div style={styles.loadingScreen}>
      <div style={styles.spinner} />
      <p style={styles.loadingText}>Loading...</p>
    </div>
  );

  const roleColor = {
    Admins: "#f59e0b",
    Providers: "#10b981",
    Patients: "#3b82f6",
  }[userGroup];

  return (
    <div style={styles.app}>
      <nav style={styles.nav}>
        <div style={styles.navLeft}>
          <span style={styles.navLogo}>🏥</span>
          <span style={styles.navTitle}>Telemedicine Platform</span>
        </div>
        <div style={styles.navRight}>
          <span style={{ ...styles.roleBadge, backgroundColor: roleColor + "22", color: roleColor, border: `1px solid ${roleColor}44` }}>
            {userGroup}
          </span>
          <button style={styles.signOutBtn} onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </nav>
      <div style={styles.content}>
        {userGroup === "Admins" && <AdminDashboard />}
        {userGroup === "Providers" && <ProviderDashboard />}
        {userGroup === "Patients" && <PatientDashboard />}
      </div>
    </div>
  );
}

const styles = {
  app: { minHeight: "100vh", backgroundColor: "#0f172a", color: "#e2e8f0" },
  nav: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 28px", backgroundColor: "#1e293b",
    borderBottom: "1px solid #334155", position: "sticky", top: 0, zIndex: 100,
  },
  navLeft: { display: "flex", alignItems: "center", gap: "10px" },
  navLogo: { fontSize: "22px" },
  navTitle: { fontWeight: "700", fontSize: "18px", color: "#f1f5f9", letterSpacing: "-0.3px" },
  navRight: { display: "flex", alignItems: "center", gap: "12px" },
  roleBadge: {
    padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "600", letterSpacing: "0.5px"
  },
  signOutBtn: {
    padding: "7px 16px", backgroundColor: "transparent", color: "#94a3b8",
    border: "1px solid #334155", borderRadius: "6px", cursor: "pointer",
    fontSize: "13px", transition: "all 0.2s",
  },
  loadingScreen: {
    display: "flex", flexDirection: "column", justifyContent: "center",
    alignItems: "center", height: "100vh", backgroundColor: "#0f172a", gap: "16px",
  },
  spinner: {
    width: "36px", height: "36px", border: "3px solid #334155",
    borderTop: "3px solid #3b82f6", borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: { color: "#64748b", fontSize: "14px" },
  content: { padding: "32px 28px", maxWidth: "1100px", margin: "0 auto" },
};

export default withAuthenticator(App, {
  loginMechanisms: ["email"],
  signUpAttributes: ["email"],
});