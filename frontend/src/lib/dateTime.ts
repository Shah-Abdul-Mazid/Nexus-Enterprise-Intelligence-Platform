/**
 * Timezone and Date-Time Formatting Utilities
 * Automatically detects user location/timezone from the browser
 * and supports manual timezone overrides (e.g. Bangladesh BST, US Eastern, etc.)
 */

export interface TimeZoneOption {
  label: string;
  value: string;
  region: string;
}

export const TIMEZONE_OPTIONS: TimeZoneOption[] = [
  { label: "Auto (Browser Detected)", value: "auto", region: "Auto" },
  { label: "Bangladesh (BST - UTC+6)", value: "Asia/Dhaka", region: "BD" },
  { label: "US Eastern (EDT/EST - UTC-4/-5)", value: "America/New_York", region: "USA" },
  { label: "US Central (CDT/CST - UTC-5/-6)", value: "America/Chicago", region: "USA" },
  { label: "US Mountain (MDT/MST - UTC-6/-7)", value: "America/Denver", region: "USA" },
  { label: "US Pacific (PDT/PST - UTC-7/-8)", value: "America/Los_Angeles", region: "USA" },
  { label: "UK / London (BST/GMT - UTC+0/+1)", value: "Europe/London", region: "UK" },
  { label: "India (IST - UTC+5:30)", value: "Asia/Kolkata", region: "India" },
  { label: "UTC (Coordinated Universal Time)", value: "UTC", region: "Global" },
];

/**
 * Returns the browser's automatically detected IANA timezone (e.g., "Asia/Dhaka").
 */
export function getBrowserTimeZone(): string {
  if (typeof Intl !== "undefined" && typeof Intl.DateTimeFormat === "function") {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dhaka";
    } catch {
      return "Asia/Dhaka";
    }
  }
  return "Asia/Dhaka";
}

/**
 * Resolves the active timezone (handling "auto" setting).
 */
export function resolveActiveTimeZone(selectedTz: string): string {
  if (!selectedTz || selectedTz === "auto") {
    return getBrowserTimeZone();
  }
  return selectedTz;
}

/**
 * Formats an ISO UTC timestamp (stored in DB) into a localized, human-friendly string
 * according to the target timezone and user locale.
 */
export function formatMessageTime(
  isoString?: string | Date | null,
  targetTimeZone = "auto"
): string {
  if (!isoString) return "";
  const date = typeof isoString === "string" ? new Date(isoString) : isoString;
  if (isNaN(date.getTime())) return "";

  const timeZone = resolveActiveTimeZone(targetTimeZone);

  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(date);
  } catch (err) {
    console.error("Date formatting error:", err);
    return date.toLocaleTimeString();
  }
}
