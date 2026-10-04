import { useEffect, useState, useCallback } from "react";
import { invitationsApi } from "../lib/api";
import { vartaWS } from "../lib/ws";
import { useAuth } from "../contexts/AuthContext";
import type { Invitation } from "../types/database";

// ─── Invites hook ─────────────────────────────────────────────────────────────

export function useInvites() {
  const { user, profile } = useAuth();
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await invitationsApi.list();
    setInvites((data as Invitation[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();

    // Listen for invitation updates via WebSocket
    const unsub = vartaWS.on("invitations", "updated", load);

    return () => { unsub(); };
  }, [load]);

  const sendInvite = async (email: string, customMessage?: string) => {
    if (!user || !profile) throw new Error("Not authenticated");
    setSending(true);
    try {
      const { data: inv, error } = await invitationsApi.create({ email, customMessage });
      if (error || !inv) throw new Error(error ?? "Failed to create invitation");

      // Send email via backend
      try {
        const res = await fetch(`/api/sendInviteEmail`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inviteCode: (inv as Invitation).invite_code,
            inviterName: profile.display_name,
            toEmail: email,
            customMessage,
          }),
        });
        if (!res.ok) {
          console.warn("Email send failed (invite row still saved):", await res.text());
        }
      } catch (e) {
        console.warn("Email send failed network error:", e);
      }

      await load();
      return inv as Invitation;
    } finally {
      setSending(false);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    await invitationsApi.revoke(inviteId);
    await load();
  };

  return { invites, loading, sending, sendInvite, revokeInvite };
}

// ─── Accept an invite (anon/new user flow) ────────────────────────────────────

export async function lookupInvite(token: string): Promise<Invitation | null> {
  const { data } = await import("../lib/api").then((m) =>
    m.api.get<Invitation>(`/api/invitations/lookup?code=${encodeURIComponent(token)}`),
  );
  return data ?? null;
}

export async function acceptInvite(token: string, _acceptorId: string): Promise<void> {
  await invitationsApi.accept(token);
}
