/**
 * Varta API Client
 * Replaces Supabase client. All data operations go through our GCP Express server.
 * Auth is handled by Firebase Auth (idToken sent as Bearer).
 */

import { firebaseAuth } from "./firebase";

// The GCP backend URL — populated from env, falls back to relative path (same origin via Nginx)
const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "";

// ─── Token Helper ──────────────────────────────────────────────────────────────

async function getAuthToken(): Promise<string | null> {
  try {
    const user = firebaseAuth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
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
    const token = await getAuthToken();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    };
    if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
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
    const token = await getAuthToken();
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${BASE_URL}/api/upload/avatar`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
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
    const token = await getAuthToken();
    const fd = new FormData();
    fd.append("file", file, fileName || "upload");
    const res = await fetch(`${BASE_URL}/api/upload/media`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
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
