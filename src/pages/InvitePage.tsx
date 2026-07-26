import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, Send, Clock, CheckCircle, XCircle, Loader2, Copy, Check, Share2 } from "lucide-react";
import { useInvites } from "../hooks/useInvites";
import { formatDistanceToNow } from "date-fns";
import type { Invitation } from "../types/database";

const STATUS_CONFIG = {
  pending: { label: "Pending", icon: Clock, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-500/20" },
  accepted: { label: "Accepted", icon: CheckCircle, color: "text-[#1E88C7]", bg: "bg-[#1E88C7]/10 border-[#1E88C7]/20" },
  expired: { label: "Expired", icon: XCircle, color: "text-zinc-400", bg: "bg-zinc-800 border-zinc-700" },
  revoked: { label: "Revoked", icon: XCircle, color: "text-red-400", bg: "bg-red-400/10 border-red-500/20" },
};

function InviteRow({ invite, onRevoke }: { invite: Invitation; onRevoke: () => void }) {
  const cfg = STATUS_CONFIG[invite.status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <div className="flex items-center gap-3.5 rounded-2xl bg-[#111b21] border border-zinc-800 p-4 transition-all hover:border-zinc-700">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1E88C7]/10 border border-[#1E88C7]/20">
        <Mail className="h-5 w-5 text-[#1E88C7]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-white text-sm">{invite.email}</p>
        {invite.custom_message && (
          <p className="truncate text-xs text-zinc-400 italic mt-0.5">"{invite.custom_message}"</p>
        )}
        <p className="mt-1 text-[11px] text-zinc-500">
          Sent: {formatDistanceToNow(new Date(invite.created_at), { addSuffix: true })}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${cfg.color} ${cfg.bg}`}>
          <Icon className="h-3.5 w-3.5" />
          {cfg.label}
        </span>
        {invite.status === "pending" && (
          <button
            type="button"
            onClick={onRevoke}
            className="text-xs text-zinc-500 hover:text-red-400 transition-colors underline font-medium"
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
  const [copiedLink, setCopiedLink] = useState(false);

  const shareableLink = `${window.location.origin}/join`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    setSuccess("");
    try {
      await sendInvite(email.trim(), message.trim() || undefined);
      setSuccess(`Invitation email sent to ${email}!`);
      setEmail("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite email.");
    }
  };

  const pending = invites.filter((i) => i.status === "pending");
  const done = invites.filter((i) => i.status !== "pending");

  return (
    <div className="flex min-h-screen flex-col bg-[#0b141a] text-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-[#111b21]/90 backdrop-blur-xl px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-zinc-400 hover:text-white transition-colors p-1 rounded-xl hover:bg-[#202c33]">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-bold text-lg text-white">Invite Friends & Team</h1>
            <p className="text-xs text-zinc-400">Share Varta via email or direct link</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto max-w-3xl mx-auto w-full px-6 py-8 space-y-6">
        {/* Shareable Link Card */}
        <div className="bg-[#111b21] border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#1E88C7]/15 border border-[#1E88C7]/30 text-[#1E88C7]">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Direct Invite Link</h3>
              <p className="text-xs text-zinc-400">Anyone with this link can apply to join your workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#0b141a] border border-zinc-800 rounded-2xl p-2 pl-4">
            <input
              type="text"
              readOnly
              value={shareableLink}
              className="bg-transparent text-xs text-zinc-300 w-full outline-none font-mono"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1E88C7] hover:bg-[#1971A5] text-white rounded-xl text-xs font-semibold shrink-0 transition-all shadow-md"
            >
              {copiedLink ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
            </button>
          </div>
        </div>

        {/* Email Invitation Form */}
        <div className="rounded-3xl bg-[#111b21] border border-zinc-800 p-6 shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Send Email Invitation</h2>
              <p className="text-xs text-zinc-400">Send an invitation email directly to your friend's inbox</p>
            </div>
          </div>

          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Email address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                required
                className="w-full rounded-2xl bg-[#0b141a] border border-zinc-800 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#1E88C7] transition-colors"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Personal message <span className="text-zinc-500 font-normal lowercase">(optional)</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hey! Join me on Varta for chats and video calls..."
                rows={3}
                className="w-full resize-none rounded-2xl bg-[#0b141a] border border-zinc-800 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#1E88C7] transition-colors"
              />
            </div>

            {error && (
              <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-400 border border-red-500/20">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-2xl bg-[#1E88C7]/10 px-4 py-3 text-xs font-semibold text-[#1E88C7] border border-[#1E88C7]/20 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1E88C7] py-3.5 font-semibold text-xs text-white disabled:opacity-50 hover:bg-[#1971A5] transition-all shadow-lg shadow-[#1E88C7]/20"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span>{sending ? "Sending Email..." : "Send Invitation Email"}</span>
            </button>
          </form>
        </div>

        {/* Invite History */}
        {!loading && invites.length > 0 && (
          <div className="space-y-4 pt-2">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <Clock className="h-4 w-4 text-[#1E88C7]" />
              Sent Invitations ({invites.length})
            </h3>

            {pending.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-amber-400 font-semibold">Pending ({pending.length})</p>
                <div className="space-y-2.5">
                  {pending.map((inv) => (
                    <InviteRow key={inv.id} invite={inv} onRevoke={() => revokeInvite(inv.id)} />
                  ))}
                </div>
              </div>
            )}

            {done.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs text-zinc-500 font-semibold">Processed ({done.length})</p>
                <div className="space-y-2.5">
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
            <Loader2 className="h-6 w-6 animate-spin text-[#1E88C7]" />
          </div>
        )}
      </div>
    </div>
  );
}
