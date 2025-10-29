import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FixedSizeList as List, type ListChildComponentProps } from "react-window";
import { useNavigate } from "react-router-dom";
import { TriageDrawer } from "../components/TriageDrawer";
import styles from "../styles/AlertsPage.module.css";
import { apiFetch, apiUrl } from "../lib/api";

export interface Alert {
  id: string;
  risk: string;
  status: string;
  createdAt: string;
  suspectTxn?: {
    id: string;
    merchant: string;
    amountCents: number;
    currency: string;
  } | null;
  customer: {
    id: string;
    name: string;
  };
  card?: {
    id: string;
    status: string;
  } | null;
}

export interface TriageEvent {
  type: string;
  detail: unknown;
  step?: string;
  ok?: boolean;
}

export interface TriageDecision {
  action: string;
  reason: string;
  [key: string]: unknown;
}

interface AlertResponse {
  alerts: Alert[];
}

export function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [events, setEvents] = useState<TriageEvent[]>([]);
  const [decision, setDecision] = useState<TriageDecision | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch("/api/alerts")
      .then((res) => res.json())
      .then((data: AlertResponse) => setAlerts(data.alerts))
      .catch(() => setAlerts([]));
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedAlert(null);
    setEvents([]);
    setDecision(null);
    setStreaming(false);
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }, []);

  useEffect(() => () => eventSourceRef.current?.close(), []);

  const openTriage = useCallback(async (alert: Alert) => {
    setSelectedAlert(alert);
    setDrawerOpen(true);
    setStreaming(true);
    setEvents([]);
    setDecision(null);

    const response = await apiFetch("/api/triage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "agent-key"
      },
      body: JSON.stringify({ alertId: alert.id })
    });

    if (!response.ok) {
      setStreaming(false);
      return;
    }

    const { runId } = await response.json();
    const source = new EventSource(apiUrl(`/api/triage/${runId}/stream`));
    eventSourceRef.current = source;

    const handleEvent = (event: MessageEvent) => {
      const payload = JSON.parse(event.data);
      setEvents((prev) => [...prev, payload]);
      if (payload.type === "decision_finalized") {
        setDecision(payload.detail as TriageDecision);
        setStreaming(false);
        source.close();
      }
      if (payload.type === "fallback_triggered") {
        setStreaming(false);
      }
    };

    source.addEventListener("plan_built", handleEvent);
    source.addEventListener("tool_update", handleEvent);
    source.addEventListener("fallback_triggered", handleEvent);
    source.addEventListener("decision_finalized", handleEvent);
  }, []);

  const handleAction = useCallback(
    async (action: "freeze" | "dispute" | "contact" | "falsePositive") => {
      if (!selectedAlert) return;
      const headers = {
        "Content-Type": "application/json",
        "x-api-key": "agent-key",
        "idempotency-key": crypto.randomUUID()
      };

      if (action === "freeze" && selectedAlert.card) {
        await apiFetch("/api/action/freeze-card", {
          method: "POST",
          headers,
          body: JSON.stringify({ cardId: selectedAlert.card.id, otp: "123456" })
        });
      }

      if (action === "dispute" && selectedAlert.suspectTxn) {
        const reasonCode = typeof decision?.reasonCode === "string" ? (decision.reasonCode as string) : "10.4";
        await apiFetch("/api/action/open-dispute", {
          method: "POST",
          headers,
          body: JSON.stringify({
            txnId: selectedAlert.suspectTxn.id,
            reasonCode,
            confirm: true
          })
        });
      }

      if (action === "contact") {
        await apiFetch("/api/action/contact-customer", {
          method: "POST",
          headers,
          body: JSON.stringify({ customerId: selectedAlert.customer.id, note: "Contacted via dashboard" })
        });
      }

      if (action === "falsePositive") {
        await apiFetch("/api/action/contact-customer", {
          method: "POST",
          headers,
          body: JSON.stringify({ customerId: selectedAlert.customer.id, note: "Marked false positive" })
        });
      }
    },
    [selectedAlert, decision]
  );

  const Row = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      const alert = alerts[index];
      if (!alert) return null;
      return (
        <div style={style} className={styles.row}>
          <div>
            <p className={styles.rowTitle}>Alert {alert.id}</p>
            <p className={styles.rowSub}>Risk {alert.risk} · {new Date(alert.createdAt).toLocaleString()}</p>
          </div>
          <div className={styles.rowActions}>
            <button onClick={() => navigate(`/customer/${alert.customer.id}`)}>View Customer</button>
            <button onClick={() => openTriage(alert)} className={styles.primaryButton}>
              Open Triage
            </button>
          </div>
        </div>
      );
    },
    [alerts, navigate, openTriage]
  );

  const itemKey = useCallback((index: number, data: Alert[]) => data[index]?.id ?? index, []);

  const height = useMemo(() => Math.min(600, alerts.length * 72), [alerts.length]);

  return (
    <section className={styles.container}>
      <header className={styles.header}>
        <div>
          <h2>Active Alerts</h2>
          <p>Stream triage updates and act safely with policy guardrails.</p>
        </div>
        <span className={styles.badge}>{alerts.length} queued</span>
      </header>

      <div className={styles.table}>
        <List
          height={height || 180}
          itemCount={alerts.length}
          itemSize={72}
          width="100%"
          itemData={alerts}
          itemKey={itemKey}
        >
          {Row}
        </List>
      </div>

      <TriageDrawer
        open={drawerOpen}
        alert={selectedAlert}
        events={events}
        decision={decision}
        loading={streaming}
        onClose={closeDrawer}
        onAction={handleAction}
      />
    </section>
  );
}
