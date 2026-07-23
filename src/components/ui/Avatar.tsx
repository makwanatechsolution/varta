import clsx from "clsx";
import type { PresenceStatus } from "../../types/database";

const RING_COLORS: Record<PresenceStatus, string> = {
  online: "ring-[#1E88C7]",
  away: "ring-amber-400",
  busy: "ring-red-500",
  dnd: "ring-red-600",
  offline: "ring-zinc-600",
};

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  presence?: PresenceStatus;
  showRing?: boolean;
  storyUnseen?: boolean;
  onClick?: () => void;
}

export function Avatar({ src, name, size = "md", presence, showRing, storyUnseen, onClick }: AvatarProps) {
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-base" };
  const initials = name.slice(0, 2).toUpperCase();

  const Component = onClick ? "button" : "div";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={clsx("relative shrink-0 rounded-full", onClick && "cursor-pointer")}
    >
      {storyUnseen !== undefined && (
        <span
          className={clsx(
            "absolute -inset-0.5 rounded-full",
            storyUnseen
              ? "bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] p-[2px]"
              : "border-2 border-zinc-600",
          )}
        />
      )}
      <span
        className={clsx(
          "relative flex items-center justify-center overflow-hidden rounded-full bg-zinc-700 font-medium text-white",
          sizes[size],
          showRing && presence && `ring-2 ring-offset-2 ring-offset-[#111b21] ${RING_COLORS[presence]}`,
        )}
      >
        {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : initials}
      </span>
    </Component>
  );
}

export function PresenceLabel({ presence, lastSeen }: { presence: PresenceStatus; lastSeen?: string }) {
  if (presence === "online") return <span className="text-[#1E88C7]">online</span>;
  if (presence === "away") return <span className="text-amber-400">away</span>;
  if (presence === "busy" || presence === "dnd") return <span className="text-red-400">busy</span>;
  if (lastSeen) {
    const diff = Date.now() - new Date(lastSeen).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return <span className="text-zinc-400">last seen {mins}m ago</span>;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return <span className="text-zinc-400">last seen {hrs}h ago</span>;
    return <span className="text-zinc-400">last seen recently</span>;
  }
  return <span className="text-zinc-500">offline</span>;
}
