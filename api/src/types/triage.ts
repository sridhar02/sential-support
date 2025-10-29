export type TriageStep =
  | "getProfile"
  | "recentTx"
  | "riskSignals"
  | "kbLookup"
  | "complianceCheck"
  | "decide"
  | "summarize";

export type TriageEventType =
  | "plan_built"
  | "tool_update"
  | "fallback_triggered"
  | "decision_finalized";

export interface TriageEvent {
  type: TriageEventType;
  step?: TriageStep;
  ok?: boolean;
  detail?: any;
}

export interface TriageResult {
  runId: string;
  alertId: string;
}

export type RecommendedAction =
  | {
      action: "freeze_card";
      reason: string;
      otpRequired: boolean;
      note?: string;
    }
  | {
      action: "open_dispute";
      reason: string;
      reasonCode: string;
      note?: string;
    }
  | {
      action: "contact_customer";
      reason: string;
      note?: string;
    }
  | {
      action: "mark_false_positive";
      reason: string;
      note?: string;
    };
