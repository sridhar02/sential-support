import { useEffect, useMemo, useState, useCallback } from "react";
import { FixedSizeList as List, type ListChildComponentProps } from "react-window";
import { useParams } from "react-router-dom";
import styles from "../styles/CustomerPage.module.css";
import { apiFetch } from "../lib/api";

interface Transaction {
  id: string;
  merchant: string;
  amountCents: number;
  currency: string;
  ts: string;
  country?: string | null;
  city?: string | null;
}

interface TransactionsResponse {
  items: Transaction[];
  nextCursor: string | null;
}

interface InsightsResponse {
  topMerchants: Array<{ merchant: string; count: number }>;
  categories: Array<{ name: string; pct: number }>;
  monthlyTrend: Array<{ month: string; sum: number }>;
  anomalies: Array<{ ts: string; z: number; note: string }>;
}

export function CustomerPage() {
  const { id } = useParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchTransactions = useCallback(
    async (cursor?: string | null) => {
      if (!id) return;
      const params = new URLSearchParams({ limit: "100" });
      if (cursor) params.append("cursor", cursor);
      const res = await apiFetch(`/api/customer/${id}/transactions?${params.toString()}`);
      const data: TransactionsResponse = await res.json();
      setTransactions((prev) => (cursor ? [...prev, ...data.items] : data.items));
      setNextCursor(data.nextCursor);
    },
    [id]
  );

  useEffect(() => {
    setTransactions([]);
    setNextCursor(null);
    if (!id) return;
    fetchTransactions();
    apiFetch(`/api/insights/${id}/summary`).then((res) => res.json()).then(setInsights);
  }, [id, fetchTransactions]);

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    fetchTransactions(nextCursor).finally(() => setLoadingMore(false));
  }, [nextCursor, loadingMore, fetchTransactions]);

  const Row = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      const txn = transactions[index];
      if (!txn) return null;
      return (
        <div style={style} className={styles.row}>
          <div>
            <p className={styles.merchant}>{txn.merchant}</p>
            <p className={styles.meta}>{new Date(txn.ts).toLocaleString()} · {txn.country ?? "-"} {txn.city ?? ""}</p>
          </div>
          <span className={styles.amount}>{(txn.amountCents / 100).toFixed(2)} {txn.currency}</span>
        </div>
      );
    },
    [transactions]
  );

  const height = useMemo(() => Math.min(640, transactions.length * 72), [transactions.length]);

  return (
    <section className={styles.container}>
      <header>
        <h2>Customer Timeline</h2>
        <p>ID {id}</p>
      </header>

      {insights && (
        <div className={styles.insights}>
          <div>
            <h4>Top Merchants</h4>
            <ul>
              {insights.topMerchants.map((item) => (
                <li key={item.merchant}>{item.merchant} · {item.count}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Category Mix</h4>
            <ul>
              {insights.categories.map((item) => (
                <li key={item.name}>{item.name} {(item.pct * 100).toFixed(1)}%</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Anomalies</h4>
            <ul>
              {insights.anomalies.map((item) => (
                <li key={item.ts}>{item.note} · z={item.z.toFixed(2)}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className={styles.timeline}>
        <List height={height || 240} itemCount={transactions.length} itemSize={72} width="100%">
          {Row}
        </List>
        {nextCursor && (
          <button className={styles.loadMore} onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load More"}
          </button>
        )}
      </div>
    </section>
  );
}
