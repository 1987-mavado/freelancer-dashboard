import { supabase } from './supabaseClient'
import { notify } from './queryBus'

// Übersetzt zwischen Postgres-Spaltennamen (snake_case) und den bestehenden
// App-/TypeScript-Interfaces (camelCase, siehe types.ts). Dadurch bleiben
// alle Page-Komponenten und die Business-Logik (Berechnungen, Exporte)
// unverändert — nur diese dünne Schicht kennt das DB-Naming.
//
// JSONB-Spalten (zeilen, phasen, positionen) werden 1:1 durchgereicht: ihre
// verschachtelten Objekte sind bereits camelCase und werden von
// PostgREST/Supabase als fertiges JS-Objekt geliefert bzw. so gespeichert.

function toCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
}

function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

export function rowToApp<T>(row: Record<string, unknown> | null | undefined): T | undefined {
  if (!row) return undefined
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    out[toCamel(k)] = v
  }
  return out as T
}

export function rowsToApp<T>(rows: Record<string, unknown>[] | null | undefined): T[] {
  return (rows ?? []).map((r) => rowToApp<T>(r) as T)
}

/**
 * Wandelt ein App-Objekt (camelCase) in eine DB-Row (snake_case) um.
 * `undefined`-Felder werden weggelassen (wichtig für partielle Updates via
 * `.update()`), `id` wird standardmäßig ausgeschlossen, da Inserts die
 * Identity-Spalte selbst vergeben (bei Bedarf mit `keepId: true` behalten,
 * z. B. für Upserts wie Stammdaten).
 */
export function appToRow(obj: Record<string, unknown>, opts: { keepId?: boolean } = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue
    if (k === 'id' && !opts.keepId) continue
    out[toSnake(k)] = v
  }
  return out
}

/**
 * Generische CRUD-Hülle für eine einfache Tabelle (kein Sonderverhalten wie
 * Singleton oder serverseitige Nummernvergabe). Ruft nach jedem
 * erfolgreichen Write `notify(table)` auf, damit `useSupabaseQuery` betroffene
 * Views neu lädt.
 */
export function makeRepo<T extends { id?: number }>(table: string) {
  return {
    async list(): Promise<T[]> {
      const { data, error } = await supabase.from(table).select('*')
      if (error) throw error
      return rowsToApp<T>(data)
    },

    async get(id: number): Promise<T | undefined> {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return rowToApp<T>(data)
    },

    async add(obj: Omit<T, 'id'>): Promise<number> {
      const row = appToRow(obj as Record<string, unknown>)
      const { data, error } = await supabase.from(table).insert(row).select('id').single()
      if (error) throw error
      notify(table)
      return (data as { id: number }).id
    },

    async update(id: number, changes: Partial<T>): Promise<void> {
      const row = appToRow(changes as Record<string, unknown>)
      const { error } = await supabase.from(table).update(row).eq('id', id)
      if (error) throw error
      notify(table)
    },

    // Speichert ein vollständiges Objekt mit bekannter (bereits existierender)
    // id (Ersatz für Dexies `.put()`). Das ist bewusst ein UPDATE und kein
    // upsert: alle id-Spalten sind `generated always as identity`, und Postgres
    // verbietet es, bei so einer Spalte explizit einen Wert einzufügen ("cannot
    // insert a non-DEFAULT value into column id") — ein upsert mit gesetzter id
    // scheiterte deshalb serverseitig immer mit HTTP 400, sobald die Zeile
    // bereits existierte (z.B. bei jedem Speichern nach dem ersten Anlegen
    // einer KVA). `put()` wird im Code ausschließlich für bereits vorhandene
    // Zeilen aufgerufen (id ist Pflichtparameter), ein reines UPDATE ist daher
    // korrekt und umgeht das Identity-Problem komplett.
    async put(obj: T & { id: number }): Promise<void> {
      const row = appToRow(obj as unknown as Record<string, unknown>)
      const { error } = await supabase.from(table).update(row).eq('id', obj.id)
      if (error) throw error
      notify(table)
    },

    async remove(id: number): Promise<void> {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
      notify(table)
    },
  }
}
