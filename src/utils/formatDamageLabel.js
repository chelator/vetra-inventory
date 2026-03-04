export function formatDamageLabel(damage) {
  if (!damage) return "";
  const parts = [damage.number, damage.type];
  if (damage.radius) parts.push(`${damage.radius}mm`);
  if (damage.locations && damage.locations.length > 0)
    parts.push(damage.locations.join(", "));
  return parts.filter(Boolean).join(" — ");
}
