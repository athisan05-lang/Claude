import type { MatchGroup, Offer } from './types';

export function normalizeCode(code: string): string {
  return code.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
}

let groupCounter = 0;
function newGroupId(): string {
  groupCounter++;
  return `grp-${Date.now()}-${groupCounter}`;
}

/**
 * Ordnet alle Zeilen aller Offerten Vergleichsgruppen zu. Bereits bestehende
 * (ggf. von Hand korrigierte) Gruppen und Zuordnungen bleiben erhalten;
 * neue oder noch nicht zugeordnete Zeilen werden automatisch anhand der
 * NPK-Nummer eingeordnet oder bilden eine neue Gruppe.
 */
export function reconcileGroups(offers: Offer[], existingGroups: MatchGroup[]): MatchGroup[] {
  const validRowIds = new Set<string>();
  for (const offer of offers) {
    for (const row of offer.rows) validRowIds.add(row.id);
  }

  const groups: MatchGroup[] = existingGroups
    .map((g) => ({
      ...g,
      assignments: Object.fromEntries(
        Object.entries(g.assignments).filter(([, rowId]) => validRowIds.has(rowId)),
      ),
    }))
    .filter((g) => Object.keys(g.assignments).length > 0);

  const assignedRowIds = new Set<string>();
  for (const g of groups) {
    for (const rowId of Object.values(g.assignments)) assignedRowIds.add(rowId);
  }

  const groupByCode = new Map<string, MatchGroup>();
  for (const g of groups) groupByCode.set(normalizeCode(g.code), g);

  for (const offer of offers) {
    for (const row of offer.rows) {
      if (assignedRowIds.has(row.id)) continue;
      const key = normalizeCode(row.code);
      let group = groupByCode.get(key);
      if (group && group.assignments[offer.id]) {
        // Diese Offerte hat in dieser Gruppe schon eine Zeile -> neue Gruppe für Duplikat.
        group = undefined;
      }
      if (!group) {
        group = {
          id: newGroupId(),
          code: row.code,
          description: row.description,
          assignments: {},
        };
        groups.push(group);
        if (!groupByCode.has(key)) groupByCode.set(key, group);
      }
      group.assignments[offer.id] = row.id;
      assignedRowIds.add(row.id);
    }
  }

  groups.sort((a, b) => a.code.localeCompare(b.code, 'de', { numeric: true }));
  return groups;
}

export function findRow(offers: Offer[], offerId: string, rowId: string) {
  const offer = offers.find((o) => o.id === offerId);
  return offer?.rows.find((r) => r.id === rowId);
}
