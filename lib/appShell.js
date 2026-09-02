// Shared helpers used across pages
export const fmt = (dateStr) => {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const statusOf = (expiryStr) => {
  if (!expiryStr) return "ok";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryStr);
  const diff = Math.round((expiry - today) / 86400000);
  if (diff < 0) return "expired";
  if (diff <= 15) return "urgent";
  if (diff <= 30) return "soon";
  return "ok";
};

export const statusMeta = {
  expired: { label: "Expired", color: "#B3261E", bg: "#FBEAE9" },
  urgent: { label: "Expiring soon", color: "#B5750A", bg: "#FBF1DF" },
  soon: { label: "Coming up", color: "#8A6D00", bg: "#FAF6E0" },
  ok: { label: "On track", color: "#1F6B4A", bg: "#E7F3ED" },
};
