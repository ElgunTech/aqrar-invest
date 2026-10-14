import {
  Apple, Beef, Flower2, Grape, Warehouse, Wheat, type LucideIcon,
} from "lucide-react";

export const ACTIVITY: Record<string, { icon: LucideIcon; color: string; tint: string }> = {
  CROP_FARMING: { icon: Wheat, color: "#B7861B", tint: "#FBF3DF" },
  LIVESTOCK: { icon: Beef, color: "#8A5530", tint: "#F6ECE4" },
  HORTICULTURE: { icon: Apple, color: "#2E8B57", tint: "#E6F3EB" },
  VITICULTURE: { icon: Grape, color: "#6E3B8E", tint: "#F1E9F6" },
  GREENHOUSE: { icon: Warehouse, color: "#1F7A8C", tint: "#E3F2F5" },
  BEEKEEPING: { icon: Flower2, color: "#C48A0C", tint: "#FCF2D9" },
};

/** Tone per status code → maps to .tag--{tone} */
export const TONE: Record<string, string> = {
  SUBMITTED: "info", UNDER_REVIEW: "warn", INFO_REQUESTED: "danger", APPROVED: "ok", REJECTED: "muted",
  DRAFT: "muted", PENDING_APPROVAL: "warn", PUBLISHED: "ok", CLOSED: "muted", CANCELLED: "muted",
  AVAILABLE: "ok", IN_COMPETITION: "gold", ASSIGNED: "muted",
  CLEARED: "ok", IN_PROGRESS: "warn", PLANNED: "danger",
  NOT_SENT: "muted", SENT: "info", VERIFIED: "ok", FAILED: "danger",
  PENDING: "warn", RECEIVED: "info",
};

export const APPLICATION_FLOW = ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED", "DECIDED"] as const;

export const FEATURE_LABELS: Record<string, string> = {
  N: "Azot (N)", P: "Fosfor (P)", K: "Kalium (K)", temperature: "Temperatur", humidity: "Rütubət", ph: "pH", rainfall: "Yağıntı",
};
