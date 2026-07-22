import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, Send, Clock, CheckCircle, XCircle, Plus, Loader2 } from "lucide-react";
import { useInvites } from "../hooks/useInvites";
import { formatDistanceToNow } from "date-fns";
import type { Invitation } from "../types/database";

const STATUS_CONFIG = {
  pending: { label: "Pending", icon: Clock, color: "text-amber-400", bg: "bg-amber-400/10" },
  accepted: { label: "Accepted", icon: CheckCircle, color: "text-[#25D366]", bg: "bg-[#25D366]/10" },
  expired: { label: "Expired", icon: XCircle, color: "text-zinc-500", bg: "bg-zinc-800" },
  revoked: { label: "Revoked", icon: XCircle, color: "text-red-400", bg: "bg-red-400/10" },
};

function InviteRow({ invite, onRevoke }: { invite: Invitation; onRevoke: () => void }) {
  const cfg = STATUS_CONFIG[invite.status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <div className="flex items-center gap-3 rounded-xl bg-[#111b21] p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366]/10">
        <Mail className="h-5 w-5 text-[#25D366]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-white text-sm">{invite.email}</p>
        {invite.custom_message && (
          <p className="truncate text-xs text-zinc-500 italic">"{invite.custom_message}"</p>
        )}
        <p className="mt-0.5 text-xs text-zinc-600">
          {formatDistanceToNow(new Date(invite.created_at), { addSuffix: true })}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color} ${cfg.bg}`}>
          <Icon className="h-3 w-3" />
          {cfg.label}
        </span>
        {invite.status === "pending" && (
          <button
            type="button"
            onClick={onRevoke}
            className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
          >
            Revoke
          </button>
        )}
      </div>
    </div>
  );
}

export function InvitePage() {
  const { invites, loading, sending, sendInvite, revokeInvite } = useInvites();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    setSuccess("");
    try {
      await sendInvite(email.trim(), message.trim() || undefined);
      setSuccess(`Invite sent to ${email}!`);
      setEmail("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    }
  };

  const pending = invites.filter((i) => i.status === "pending");
  const done = invites.filter((i) => i.status !== "pending");

  return (
    <div className="flex min-h-screen flex-col bg-[#0b141a] text-white">
      {/* Header */}
      <header className="flex items-center gap-4 bg-[#111b21] px-4 py-3 shadow">
        <Link to="/" className="text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-semibold">Invite People</h1>
          <p className="text-xs text-zinc-500">Bring friends to Varta</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Invite form */}
        <div className="p-4">
          <div className="rounded-2xl bg-[#111b21] p-5 shadow-lg">
            {/* Illustration */}
            <div className="mb-5 flex flex-col items-center text-center">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#25D366]/10">
                <Mail className="h-8 w-8 text-[#25D366]" />
              </div>
              <h2 className="text-lg font-bold text-white">Send an Invite</h2>
              <p className="mt-1 text-sm text-zinc-400 max-w-xs">
                Your friend will receive a beautiful email invite with a personal join link
              </p>
            </div>

            <form onSubmit={handleSend} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Email address *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="friend@example.com"
                  required
                  className="w-full rounded-xl bg-[#202c33] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:ring-1 focus:ring-[#25D366]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Personal message <span className="text-zinc-600">(optional)</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Hey! Join me on Varta, it's amazing..."
                  rows={2}
                  className="w-full resize-none rounded-xl bg-[#202c33] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:ring-1 focus:ring-[#25D366]"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400 border border-red-500/20">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-lg bg-[#25D366]/10 px-3 py-2 text-sm text-[#25D366] border border-[#25D366]/20 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={sending || !email.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 font-semibold text-white disabled:opacity-50 hover:bg-[#1da855] transition-colors"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? "Sending..." : "Send Invite"}
              </button>
            </form>
          </div>
        </div>

        {/* Invite history */}
        {!loading && invites.length > 0 && (
          <div className="px-4 pb-8">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <Clock className="h-3.5 w-3.5" />
              Invite History ({invites.length})
            </p>

            {pending.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs text-zinc-600">Pending ({pending.length})</p>
                <div className="space-y-2">
                  {pending.map((inv) => (
                    <InviteRow key={inv.id} invite={inv} onRevoke={() => revokeInvite(inv.id)} />
                  ))}
                </div>
              </div>
            )}

            {done.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-zinc-600">Completed</p>
                <div className="space-y-2">
                  {done.map((inv) => (
                    <InviteRow key={inv.id} invite={inv} onRevoke={() => revokeInvite(inv.id)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
          </div>
        )}

        {!loading && invites.length === 0 && (
          <div className="flex flex-col items-center py-8 text-zinc-600">
            <Plus className="mb-2 h-8 w-8 opacity-30" />
            <p className="text-sm">No invites sent yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
