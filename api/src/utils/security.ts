const BLOCKED_PATTERNS = [/ignore all/i, /system prompt/i, /override policy/i];

export function sanitizeInput<T>(value: T): T {
  if (typeof value === "string") {
    if (BLOCKED_PATTERNS.some((pattern) => pattern.test(value))) {
      return "[sanitized]" as unknown as T;
    }
    return value.replace(/[{}<>]/g, "") as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeInput(item)) as unknown as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeInput(v)])
    ) as T;
  }
  return value as unknown as T;
}
