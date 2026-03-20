const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== "undefined") {
      if (token) {
        localStorage.setItem("shroud_token", token);
      } else {
        localStorage.removeItem("shroud_token");
      }
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("shroud_token");
    }
    return this.token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      this.setToken(null);
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("Unauthorized");
    }

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Request failed");
    }

    return data as T;
  }

  // Auth
  async register(email: string, password: string, name?: string, company?: string) {
    const data = await this.request<{ token: string; developer: { id: string; email: string } }>(
      "POST",
      "/v1/auth/register",
      { email, password, name, company }
    );
    this.setToken(data.token);
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request<{ token: string; developer: Record<string, unknown> }>(
      "POST",
      "/v1/auth/login",
      { email, password }
    );
    this.setToken(data.token);
    return data;
  }

  async getMe() {
    return this.request<{ developer: Record<string, unknown> }>("GET", "/v1/auth/me");
  }

  logout() {
    this.setToken(null);
  }

  // API Keys
  async createApiKey(name: string, environment: string, scope: string) {
    return this.request<{
      id: string;
      key: string;
      keyPrefix: string;
      name: string;
      environment: string;
      scope: string;
      createdAt: string;
    }>("POST", "/v1/auth/api-keys", { name, environment, scope });
  }

  async listApiKeys() {
    return this.request<{
      keys: Array<{
        id: string;
        keyPrefix: string;
        name: string;
        environment: string;
        scope: string;
        isActive: boolean;
        lastUsedAt: string | null;
        createdAt: string;
        revokedAt: string | null;
      }>;
    }>("GET", "/v1/auth/api-keys");
  }

  async revokeApiKey(id: string) {
    return this.request<{ success: boolean }>("DELETE", `/v1/auth/api-keys/${id}`);
  }

  // Usage
  async getUsage() {
    return this.request<{
      totalRequests: number;
      totalErrors: number;
      avgLatencyMs: number;
      relayTransactions: number;
      period: string;
    }>("GET", "/v1/usage");
  }

  async getUsageHistory(days: number = 7) {
    return this.request<{
      history: Array<{
        hour: string;
        endpoint: string;
        requestCount: number;
        errorCount: number;
        totalLatencyMs: number;
      }>;
      period: string;
    }>("GET", `/v1/usage/history?days=${days}`);
  }
}

export const api = new ApiClient();
