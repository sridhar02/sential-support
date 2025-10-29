const panRegex = /(\b\d{13,19}\b)/g;
const emailRegex = /([\w.+-]+)@([\w-]+\.[\w-.]+)/g;

export function redactPII(input: string): string {
  return input
    .replace(panRegex, "***REDACTED***")
    .replace(emailRegex, (_match, user, domain) => {
      const safeUser = typeof user === "string" && user.length > 0 ? user[0] : "*";
      return `${safeUser}***@${domain}`;
    });
}

export function maskObject<T>(payload: T): T {
  if (payload === null || payload === undefined) {
    return payload;
  }
  const cloned = JSON.parse(JSON.stringify(payload));
  const walk = (value: any): any => {
    if (typeof value === "string") {
      return redactPII(value);
    }
    if (Array.isArray(value)) {
      return value.map(walk);
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v)]));
    }
    return value;
  };
  return walk(cloned);
}
