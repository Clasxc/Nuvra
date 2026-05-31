// src/lib/datetime.ts
// All datetime formatting in Turkish time (Europe/Istanbul, UTC+3).
//
// Backend stores naive UTC. JS's `new Date("2026-05-14T15:30:00")` (no Z suffix)
// parses as LOCAL time — which silently shifts the displayed value by the user's
// timezone offset. We work around this by appending Z if missing, then format
// everything explicitly in Europe/Istanbul.

const TZ = "Europe/Istanbul";

/** Parse a backend datetime string as UTC, regardless of whether it has Z. */
export function parseBackendDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const normalized =
    s.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(s) ? s : s + "Z";
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

/** "5m ago", "2h ago", "3d ago" — uses real UTC diff so no timezone skew. */
export function timeAgo(s: string | null | undefined): string {
  const d = parseBackendDate(s);
  if (!d) return "";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(s);
}

/** "14 May 2026" in Turkish time. */
export function formatDate(s: string | null | undefined): string {
  const d = parseBackendDate(s);
  if (!d) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  });
}

/** "14 May 2026, 18:30" in Turkish time. */
export function formatDateTime(s: string | null | undefined): string {
  const d = parseBackendDate(s);
  if (!d) return "";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
    hour12: false,
  });
}

/** "18:30" in Turkish time. */
export function formatTime(s: string | null | undefined): string {
  const d = parseBackendDate(s);
  if (!d) return "";
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
    hour12: false,
  });
}
