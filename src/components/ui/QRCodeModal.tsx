import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { X, Copy, Download, Check, Sparkles, UserPlus } from "lucide-react";
import { Avatar } from "./Avatar";
import type { Profile } from "../../types/database";
import { useNavigate } from "react-router-dom";
import { generateQRCodeSVG } from "../../lib/qrcode";

interface QRCodeModalProps {
  profile: Profile | null;
  onClose: () => void;
}

export function QRCodeModal({ profile, onClose }: QRCodeModalProps) {
  const [copied, setCopied] = useState(false);
  const [connectInput, setConnectInput] = useState("");
  const [connectError, setConnectError] = useState("");
  const [activeTab, setActiveTab] = useState<"my-code" | "scan">("my-code");
  const navigate = useNavigate();

  const profileUrl = `${window.location.origin}/?user=${profile?.id || ""}`;
  const qrSvgMarkup = useMemo(() => generateQRCodeSVG(profileUrl, { size: 280, fgColor: "#0b141a" }), [profileUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([qrSvgMarkup], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Varta-QR-${profile?.username || "user"}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to download QR code", err);
    }
  };

  const handleConnect = () => {
    if (!connectInput.trim()) return;
    const text = connectInput.trim();
    // Extract ID or username from URL or raw text
    let target = text;
    if (text.includes("user=")) {
      target = text.split("user=")[1]?.split("&")[0] || text;
    }

    if (target) {
      onClose();
      navigate(`/new-chat?connect=${encodeURIComponent(target)}`);
    } else {
      setConnectError("Invalid QR link or User ID.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md bg-card border border-border-subtle rounded-3xl p-6 shadow-2xl overflow-hidden"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-muted hover:bg-surface hover:text-main transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tab Header */}
        <div className="flex bg-surface p-1 rounded-2xl mb-6 border border-border-subtle">
          <button
            type="button"
            onClick={() => setActiveTab("my-code")}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === "my-code" ? "bg-primary text-white shadow-md" : "text-muted hover:text-main"
            }`}
          >
            My QR Card
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("scan")}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === "scan" ? "bg-primary text-white shadow-md" : "text-muted hover:text-main"
            }`}
          >
            Scan / Connect
          </button>
        </div>

        {activeTab === "my-code" ? (
          <div className="flex flex-col items-center text-center space-y-5">
            <div className="relative">
              <div className="absolute -inset-2 bg-gradient-to-r from-primary/30 via-primary/20 to-primary/40 rounded-full blur-lg opacity-75" />
              <Avatar
                src={profile?.avatar_url}
                name={profile?.display_name || "User"}
                size="lg"
                showRing
              />
            </div>

            <div>
              <h3 className="text-xl font-bold text-main">{profile?.display_name}</h3>
              <p className="text-xs text-primary font-semibold">@{profile?.username || "username"}</p>
            </div>

            {/* Genuine SVG QR Code Container */}
            <div className="relative p-4 bg-white rounded-3xl shadow-xl border border-gray-200 flex items-center justify-center">
              <div
                className="w-48 h-48 flex items-center justify-center rounded-xl overflow-hidden"
                dangerouslySetInnerHTML={{ __html: qrSvgMarkup }}
              />
            </div>

            <p className="text-xs text-muted max-w-xs">
              Scan this QR code with any camera or share your profile link to connect instantly.
            </p>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 w-full pt-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-surface border border-border-subtle text-xs font-semibold text-main hover:bg-card transition-all"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? "Copied!" : "Copy Link"}</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-primary text-xs font-semibold text-white shadow-lg shadow-primary/20 hover:scale-105 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Save Image</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 text-center py-4">
            <div className="p-4 rounded-3xl bg-primary/10 text-primary inline-flex">
              <UserPlus className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-main">Connect via QR or Link</h3>
              <p className="text-xs text-muted mt-1">
                Paste a Varta QR invite URL or User ID to start a conversation immediately.
              </p>
            </div>

            <div className="space-y-3 text-left">
              <input
                value={connectInput}
                onChange={(e) => {
                  setConnectInput(e.target.value);
                  setConnectError("");
                }}
                placeholder="Paste Varta QR URL or User ID..."
                className="w-full rounded-2xl bg-surface border border-border-subtle px-4 py-3 text-sm text-main outline-none focus:ring-2 focus:ring-primary/20"
              />
              {connectError && <p className="text-xs text-red-400">{connectError}</p>}
            </div>

            <button
              type="button"
              onClick={handleConnect}
              className="w-full py-3 rounded-2xl bg-primary text-xs font-bold text-white shadow-lg shadow-primary/20 hover:scale-105 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Start Chat</span>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
