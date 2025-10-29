const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function normalize(path: string): string {
  if (!path.startsWith("/")) {
    return `/${path}`;
  }
  return path;
}

export function apiUrl(path: string): string {
  const normalized = normalize(path);
  return `${base}${normalized}`;
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}
