import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
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
    const { data } = await supabase
      .from("invitations")
      .select("*")
      .eq("inviter_id", user.id)
      .order("created_at", { ascending: false });
    setInvites((data as Invitation[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();

    const channel = supabase
      .channel("invitations_watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "invitations" }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const sendInvite = async (email: string, customMessage?: string) => {
    if (!user || !profile) throw new Error("Not authenticated");
    setSending(true);
    try {
      // 1. Insert invitation row
      const { data: inv, error } = await supabase
        .from("invitations")
        .insert({
          inviter_id: user.id,
          email,
          custom_message: customMessage || null,
          status: "pending",
        })
        .select()
        .single();

      if (error || !inv) throw error ?? new Error("Failed to create invitation");

      // 2. Call Vercel Serverless Function to send email
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
    await supabase
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", inviteId);
    await load();
  };

  return { invites, loading, sending, sendInvite, revokeInvite };
}

// ─── Accept an invite (anon/new user flow) ────────────────────────────────────

export async function lookupInvite(token: string): Promise<Invitation | null> {
  const { data } = await supabase
    .from("invitations")
    .select("*, inviter:profiles!inviter_id(id, display_name, avatar_url)")
    .eq("invite_code", token)
    .eq("status", "pending")
    .maybeSingle();
  return (data as Invitation | null);
}

export async function acceptInvite(token: string, acceptorId: string): Promise<void> {
  await supabase
    .from("invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("invite_code", token)
    .eq("status", "pending");

  // Optional: auto-add inviter as contact
  const invite = await lookupInvite(token);
  if (invite && invite.inviter_id !== acceptorId) {
    await supabase.from("contacts").upsert([
      { user_id: acceptorId, contact_id: invite.inviter_id },
      { user_id: invite.inviter_id, contact_id: acceptorId },
    ], { onConflict: "user_id,contact_id" });
  }
}
