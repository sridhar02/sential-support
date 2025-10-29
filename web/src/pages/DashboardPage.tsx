import { useEffect, useState } from "react";
import styles from "../styles/DashboardPage.module.css";
import { apiFetch } from "../lib/api";

interface Kpis {
  alertsOpen: number;
  disputesOpen: number;
  avgTriageLatencyMs: number;
}

export function DashboardPage() {
  const [kpis, setKpis] = useState<Kpis | null>(null);

  useEffect(() => {
    apiFetch("/api/alerts/kpis")
      .then((res) => res.json())
      .then(setKpis)
      .catch(() => setKpis(null));
  }, []);

  return (
    <section className={styles.container}>
      <header>
        <h2>Operations Dashboard</h2>
        <p>Overview of active alerts, disputes, and triage performance.</p>
      </header>
      <div className={styles.grid}>
        <div className={styles.card}>
          <h3>Alerts in Queue</h3>
          <p>{kpis?.alertsOpen ?? "-"}</p>
        </div>
        <div className={styles.card}>
          <h3>Open Disputes</h3>
          <p>{kpis?.disputesOpen ?? "-"}</p>
        </div>
        <div className={styles.card}>
          <h3>Avg Triage Latency</h3>
          <p>{kpis ? `${kpis.avgTriageLatencyMs} ms` : "-"}</p>
        </div>
      </div>
    </section>
  );
}
