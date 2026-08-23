export function getStat(entry, name) {
  return entry.stats?.find((s) => s.name === name);
}
