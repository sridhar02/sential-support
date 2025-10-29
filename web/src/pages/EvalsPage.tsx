import { useEffect, useState } from "react";
import styles from "../styles/EvalsPage.module.css";
import { apiFetch } from "../lib/api";

interface EvalCase {
  name: string;
  alertId: string;
  expected: Record<string, unknown>;
}

export function EvalsPage() {
  const [cases, setCases] = useState<EvalCase[]>([]);

  useEffect(() => {
    apiFetch("/api/evals")
      .then((res) => res.json())
      .then((data) => setCases(data.results))
      .catch(() => setCases([]));
  }, []);

  return (
    <section className={styles.container}>
      <header>
        <h2>Eval Scenarios</h2>
        <p>Golden cases validated locally. Use CLI to run npm run eval.</p>
      </header>
      <div className={styles.list}>
        {cases.map((item) => (
          <article key={item.name} className={styles.card}>
            <h3>{item.name}</h3>
            <p>Alert {item.alertId}</p>
            <pre>{JSON.stringify(item.expected, null, 2)}</pre>
          </article>
        ))}
      </div>
    </section>
  );
}
