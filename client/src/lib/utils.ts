import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function toJSTDate(d: any): Date {
  if (d instanceof Date) return d;
  if (typeof d === "string") {
    // "YYYY-MM-DD HH:MM:SS" → treat as UTC
    return new Date(d.includes("T") ? d : d.replace(" ", "T") + "Z");
  }
  return new Date(d);
}

export function fmtDate(d: any): string {
  return toJSTDate(d).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });
}

export function fmtDateTime(d: any): string {
  return toJSTDate(d).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function fmtDateTimeSeconds(d: any): string {
  return toJSTDate(d).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function fmtDateShort(d: any): string {
  return toJSTDate(d).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit" });
}

export function fmtTime(d: any): string {
  return toJSTDate(d).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });
}
