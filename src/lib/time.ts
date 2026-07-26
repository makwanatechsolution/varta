import type { TimeFormatMode } from "../contexts/SettingsContext";

export function formatChatTime(value: string | Date | null | undefined, timeFormat: TimeFormatMode = "24") {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: timeFormat === "12",
  }).format(date);
}
