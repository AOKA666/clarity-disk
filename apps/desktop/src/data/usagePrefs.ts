/** 会话内「还用不用」选择；写入 sessionStorage 便于刷新后保留。 */
export type UsageChoice = "active" | "unused";

const STORAGE_KEY = "clarity-disk-usage-prefs-v1";

function readAll(): Record<string, UsageChoice> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, UsageChoice>;
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, UsageChoice>) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function usagePrefKey(item: {
  id: string;
  unknownGroup?: string;
  ruleId?: string;
  label: string;
}): string {
  return item.unknownGroup ?? item.ruleId ?? item.id;
}

export function getUsagePref(key: string): UsageChoice | null {
  return readAll()[key] ?? null;
}

export function setUsagePref(key: string, choice: UsageChoice): void {
  const map = readAll();
  map[key] = choice;
  writeAll(map);
}

export function clearUsagePrefs(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
