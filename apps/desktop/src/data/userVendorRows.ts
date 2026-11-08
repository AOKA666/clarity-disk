import type { ScanPayload, ScanRow, SpaceItem } from "./homeModel";
import { isVisibleListRow, rowToSpaceItem } from "./homeModel";

export function vendorKeyForItem(item: SpaceItem): string {
  if (item.unknownGroup) return item.unknownGroup;
  if (item.ruleId) return `rule-${item.ruleId}`;
  return item.id;
}

function isUsersTopRow(row: ScanRow): boolean {
  return (
    row.id.includes("vol-users") ||
    row.label.includes("用户目录 (Users)")
  );
}

export function displayVendorLabel(item: SpaceItem): string {
  let label = item.label.trim();
  if (label.startsWith("尚未识别 · ")) {
    label = label.slice("尚未识别 · ".length);
  }
  const dot = label.indexOf(" · ");
  if (dot > 0) {
    return label.slice(0, dot);
  }
  return label;
}

export function sortBySizeDesc(items: SpaceItem[]): SpaceItem[] {
  return [...items].sort((a, b) => b.sizeGb - a.sizeGb);
}

export function buildUserVendorPersonalItems(scan: ScanPayload): SpaceItem[] {
  const items: SpaceItem[] = [];

  for (const row of scan.byApp.filter(
    (r) => r.bucket === "user" && isVisibleListRow(r),
  )) {
    const item = rowToSpaceItem(row);
    items.push({ ...item, label: displayVendorLabel(item) });
  }

  const coarse = new Map<string, SpaceItem>();
  for (const row of scan.unknownRows.filter(
    (r) => r.bucket === "user" && isVisibleListRow(r),
  )) {
    const item = rowToSpaceItem(row);
    const key = item.unknownGroup ?? item.id;
    const label = displayVendorLabel(item);
    const prev = coarse.get(key);
    if (!prev) {
      coarse.set(key, {
        ...item,
        id: `vendor-${key}`,
        label,
        purpose: item.purpose ?? item.path,
      });
    } else {
      prev.sizeGb += item.sizeGb;
    }
  }
  items.push(...coarse.values());

  for (const row of scan.byTopLevel.filter(
    (r) =>
      r.bucket === "user" && isVisibleListRow(r) && !isUsersTopRow(r),
  )) {
    const item = rowToSpaceItem(row);
    items.push({ ...item, label: displayVendorLabel(item) });
  }

  return sortBySizeDesc(items);
}

export function slimCacheHintsForUserItem(
  scan: ScanPayload,
  item: SpaceItem,
): SpaceItem[] {
  const needle = displayVendorLabel(item).toLowerCase();
  const fromRules = scan.byApp
    .filter(
      (r) =>
        r.bucket === "slim" &&
        isVisibleListRow(r) &&
        r.label.toLowerCase().includes(needle),
    )
    .map(rowToSpaceItem);

  const fromUnknown = scan.unknownRows
    .filter(
      (r) =>
        r.bucket === "slim" &&
        isVisibleListRow(r) &&
        displayVendorLabel(rowToSpaceItem(r)).toLowerCase() === needle,
    )
    .map(rowToSpaceItem);

  return sortBySizeDesc([...fromRules, ...fromUnknown]);
}
