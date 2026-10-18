/**
 * Varta API Client
 * Replaces Supabase client. All data operations go through our Express backend service.
 * Auth is handled by Firebase Auth (idToken sent as Bearer).
 */

import { firebaseAuth } from "./firebase";

// The backend URL — populated from env, falls back to the production Render domain or localhost
const DEFAULT_API_URL =
  typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:4000"
    : "https://api.chat.makwanatechsolution.in";

const BASE_URL = ((import.meta.env.VITE_API_URL as string | undefined)?.trim() || DEFAULT_API_URL).replace(/\/$/, "");

if (typeof window !== "undefined") {
  console.log("[Varta API] Backend URL:", BASE_URL);
}

// ─── Token Helper ──────────────────────────────────────────────────────────────

async function getAuthToken(forceRefresh = false): Promise<string> {
  await firebaseAuth.authStateReady();
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("Please sign in to continue.");
  return user.getIdToken(forceRefresh);
}

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error("The Varta server took too long to respond. Please retry the connection.");
    throw error;
  } finally { clearTimeout(timeout); }
}

// Shared by JSON requests and uploads so expired sessions recover consistently.
async function authenticatedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  await firebaseAuth.authStateReady();
  const user = firebaseAuth.currentUser;
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${await getAuthToken()}`);
  let response = await fetchWithTimeout(`${BASE_URL}${path}`, { ...options, headers });
  if (response.status === 401 && firebaseAuth.currentUser === user) {
    headers.set("Authorization", `Bearer ${await getAuthToken(true)}`);
    response = await fetchWithTimeout(`${BASE_URL}${path}`, { ...options, headers });
  }
  return response;
}

// ─── Core Fetch Wrapper ────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data: T | null;
  error: string | null;
}

async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  try {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    const res = await authenticatedFetch(path, { ...options, headers });
    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const errBody = await res.json();
        errMsg = errBody?.error || errMsg;
      } catch { /* ignore */ }
      return { data: null, error: errMsg };
    }

    const data = await res.json();
    return { data: data as T, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message || "Network error" };
  }
}

// ─── Generic CRUD Helpers ──────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) =>
    apiFetch<T>(path, { method: "DELETE" }),
};

// ─── Profiles ─────────────────────────────────────────────────────────────────

export const profilesApi = {
  getMe: () => api.get<any>("/api/profiles/me"),
  update: (data: Record<string, any>) => api.patch<any>("/api/profiles/me", data),
  getById: (id: string) => api.get<any>(`/api/profiles/${id}`),
  search: (query: string) => api.get<any[]>(`/api/profiles/search?q=${encodeURIComponent(query)}`),
  updatePresence: (presence: string) => api.patch("/api/profiles/me/presence", { presence }),
  uploadAvatar: async (file: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await authenticatedFetch("/api/upload/avatar", {
      method: "POST",
      body: fd,
    });
    if (!res.ok) return null;
    const { url } = await res.json();
    return url as string;
  },
};

// ─── Conversations ─────────────────────────────────────────────────────────────

export const conversationsApi = {
  list: () => api.get<any[]>("/api/conversations"),
  getById: (id: string) => api.get<any>(`/api/conversations/${id}`),
  create: (data: { type: string; title?: string; memberIds: string[] }) =>
    api.post<any>("/api/conversations", data),
  update: (id: string, data: Record<string, any>) =>
    api.patch<any>(`/api/conversations/${id}`, data),
  getMembers: (id: string) => api.get<any[]>(`/api/conversations/${id}/members`),
  addMember: (id: string, userId: string) =>
    api.post(`/api/conversations/${id}/members`, { userId }),
  removeMember: (id: string, userId: string) =>
    api.delete(`/api/conversations/${id}/members/${userId}`),
  search: async (query: string) => {
    // Client side filtering since backend doesn't have a specific endpoint yet
    const { data, error } = await api.get<any[]>("/api/conversations");
    if (error || !data) return { data: [], error };
    return {
      data: data.filter((c) => c.type !== "direct" && c.title?.toLowerCase().includes(query.toLowerCase())),
      error: null
    };
  }
};

// ─── Messages ─────────────────────────────────────────────────────────────────

export const messagesApi = {
  list: (conversationId: string, cursor?: string) =>
    api.get<any[]>(
      `/api/conversations/${conversationId}/messages${cursor ? `?cursor=${cursor}` : ""}`,
    ),
  send: (
    conversationId: string,
    data: {
      content?: string;
      type?: string;
      media_url?: string;
      gif_url?: string;
      reply_to_id?: string;
    },
  ) => api.post<any>(`/api/conversations/${conversationId}/messages`, data),
  update: (messageId: string, content: string) =>
    api.patch<any>(`/api/messages/${messageId}`, { content }),
  delete: (messageId: string) => api.delete(`/api/messages/${messageId}`),
  star: (messageId: string, starred: boolean) =>
    api.patch(`/api/messages/${messageId}/star`, { starred }),
  uploadMedia: async (file: File | Blob, fileName?: string): Promise<string | null> => {
    const fd = new FormData();
    fd.append("file", file, fileName || "upload");
    const res = await authenticatedFetch("/api/upload/media", {
      method: "POST",
      body: fd,
    });
    if (!res.ok) return null;
    const { url } = await res.json();
    return url as string;
  },
  search: (query: string) => api.get<any[]>(`/api/messages/search?q=${encodeURIComponent(query)}`),
};

// ─── Reactions ─────────────────────────────────────────────────────────────────

export const reactionsApi = {
  toggle: (messageId: string, emoji: string) =>
    api.post(`/api/messages/${messageId}/reactions`, { emoji }),
  list: (messageId: string) => api.get<any[]>(`/api/messages/${messageId}/reactions`),
};

// ─── Calls ────────────────────────────────────────────────────────────────────

export const callsApi = {
  list: () => api.get<any[]>("/api/calls"),
  create: (data: {
    conversation_id: string;
    type: string;
    participant_ids: string[];
  }) => api.post<any>("/api/calls", data),
  update: (callId: string, data: Record<string, any>) =>
    api.patch<any>(`/api/calls/${callId}`, data),
  sendSignal: (
    callId: string,
    signal: { to_user_id: string; signal_type: string; payload: unknown },
  ) => api.post(`/api/calls/${callId}/signals`, signal),
  getSignals: (callId: string, afterId?: string) =>
    api.get<any[]>(`/api/calls/${callId}/signals${afterId ? `?after=${afterId}` : ""}`),
  delete: (callId: string) => api.delete(`/api/calls/${callId}`),
  deleteByInitiator: () => api.delete("/api/calls/mine"),
};

// ─── Meetings ─────────────────────────────────────────────────────────────────

export const meetingsApi = {
  list: () => api.get<any[]>("/api/meetings"),
  create: (data: Record<string, any>) => api.post<any>("/api/meetings", data),
  update: (id: string, data: Record<string, any>) => api.patch<any>(`/api/meetings/${id}`, data),
  delete: (id: string) => api.delete(`/api/meetings/${id}`),
};

// ─── Statuses / Stories ───────────────────────────────────────────────────────

export const statusesApi = {
  list: () => api.get<any[]>("/api/statuses"),
  create: (data: Record<string, any>) => api.post<any>("/api/statuses", data),
  markViewed: (statusId: string, reactionEmoji?: string) =>
    api.post(`/api/statuses/${statusId}/views`, { reactionEmoji }),
  delete: (id: string) => api.delete(`/api/statuses/${id}`),
};

// ─── Contacts ─────────────────────────────────────────────────────────────────

export const contactsApi = {
  list: () => api.get<any[]>("/api/contacts"),
  upsert: (contacts: Array<{ contact_id: string; nickname?: string; is_close_friend?: boolean }>) =>
    api.post("/api/contacts", { contacts }),
};

// ─── Invitations ──────────────────────────────────────────────────────────────

export const invitationsApi = {
  list: () => api.get<any[]>("/api/invitations"),
  create: (data: { email: string; customMessage?: string }) =>
    api.post<any>("/api/invitations", data),
  accept: (code: string) => api.post<any>("/api/invitations/accept", { code }),
  revoke: (id: string) => api.delete(`/api/invitations/${id}`),
};

// ─── Push Tokens ──────────────────────────────────────────────────────────────

export const pushTokensApi = {
  remove: (token: string) => api.post("/api/push-tokens/remove", { token }),
  test: () => api.post<{ sent: number; failed: number }>("/api/push-tokens/test", {}),
  upsert: (token: string, platform = "web") =>
    api.post("/api/push-tokens", { token, platform }),
};

// ─── Admin ────────────────────────────────────────────────────────────────────

export const adminApi = {
  getUsers: () => api.get<any[]>("/api/admin/users"),
  approveUser: (userId: string) => api.post(`/api/admin/users/${userId}/approve`, {}),
  revokeUser: (userId: string) => api.post(`/api/admin/users/${userId}/revoke`, {}),
  deleteUser: (userId: string) => api.delete(`/api/admin/users/${userId}`),
  createUser: (data: { email: string; password: string; displayName: string }) =>
    api.post<any>("/api/admin/users", data),
  getSettings: () => api.get<any>("/api/admin/settings"),
  updateSettings: (data: Record<string, any>) => api.patch("/api/admin/settings", data),
};

// ─── GIF Favorites ────────────────────────────────────────────────────────────

export const gifApi = {
  getFavorites: () => api.get<any[]>("/api/gif-favorites"),
  upsert: (data: { gif_url: string; provider: string }) =>
    api.post("/api/gif-favorites", data),
};

// ─── Starred Messages ─────────────────────────────────────────────────────────

export const starredApi = {
  list: () => api.get<any[]>("/api/messages/starred"),
};
