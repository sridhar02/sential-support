import { useEffect, useRef } from "react";
import type { Alert, TriageEvent, TriageDecision } from "../pages/AlertsPage";
import { useFocusTrap } from "../hooks/useFocusTrap";
import styles from "../styles/TriageDrawer.module.css";

interface Props {
  open: boolean;
  alert: Alert | null;
  events: TriageEvent[];
  decision: TriageDecision | null;
  loading: boolean;
  onClose: () => void;
  onAction: (action: "freeze" | "dispute" | "contact" | "falsePositive") => void;
}

export function TriageDrawer({ open, alert, events, decision, loading, onClose, onAction }: Props) {
  const drawerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(drawerRef, open);

  useEffect(() => {
    const node = drawerRef.current;
    if (!node) return;
    const handler = () => onClose();
    node.addEventListener("focus-trap-close", handler);
    return () => node.removeEventListener("focus-trap-close", handler);
  }, [onClose]);

  if (!open || !alert) return null;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="triage-title">
      <div className={styles.drawer} ref={drawerRef}>
        <header className={styles.header}>
          <div>
            <h3 id="triage-title">Triage for Alert {alert.id}</h3>
            <p className={styles.subTitle}>Customer {alert.customer.name} · Risk {alert.risk}</p>
          </div>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close triage">
            ×
          </button>
        </header>

        <section className={styles.section} aria-live="polite">
          <h4>Streaming Plan</h4>
          <div className={styles.events}>
            {events.map((event, idx) => (
              <div key={idx} className={styles.eventRow}>
                <span className={styles.eventType}>{event.type}</span>
                <pre>{JSON.stringify(event.detail, null, 2)}</pre>
              </div>
            ))}
            {loading && <p className={styles.loading}>Running agents…</p>}
          </div>
        </section>

        <section className={styles.section}>
          <h4>Recommended Action</h4>
          {decision ? (
            <div className={styles.decisionCard}>
              <p className={styles.decisionAction}>{decision.action}</p>
              <p className={styles.decisionReason}>{decision.reason}</p>
            </div>
          ) : (
            <p>No decision yet.</p>
          )}
        </section>

        <section className={styles.section}>
          <h4>Actions</h4>
          <div className={styles.actions}>
            <button onClick={() => onAction("freeze")} disabled={loading}>
              Freeze Card
            </button>
            <button onClick={() => onAction("dispute")} disabled={loading}>
              Open Dispute
            </button>
            <button onClick={() => onAction("contact")} disabled={loading}>
              Contact Customer
            </button>
            <button onClick={() => onAction("falsePositive")} disabled={loading}>
              Mark False Positive
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
