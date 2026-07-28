const UNIT_CODE_MAP: Record<string, string> = {
  'std.': 'HUR',
  'std': 'HUR',
  'stunde': 'HUR',
  'stunden': 'HUR',
  'h': 'HUR',
  'tag': 'DAY',
  'tage': 'DAY',
  'tagessatz': 'DAY',
  'stk.': 'C62',
  'stk': 'C62',
  'stück': 'C62',
  'pauschale': 'C62',
  'monat': 'MON',
  'monate': 'MON',
}

export function unitCodeFor(einheit: string): string {
  return UNIT_CODE_MAP[einheit.trim().toLowerCase()] ?? 'C62'
}
