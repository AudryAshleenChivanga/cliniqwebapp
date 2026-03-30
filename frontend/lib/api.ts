const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

function authHeader() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("cliniq_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "API request failed");
  }
  return response.json() as Promise<T>;
}

export async function login(email: string, password: string) {
  return apiRequest<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}
