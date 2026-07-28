// Leichtgewichtiges Pub-Sub, das Dexies `liveQuery`-Reaktivität ersetzt.
// Mutations-Helfer rufen nach einem erfolgreichen Supabase-Write `notify(table)`
// auf; `useSupabaseQuery` abonniert die von ihm gelesenen Tabellen und lädt bei
// einer Benachrichtigung automatisch neu. Bewusst kein Supabase-Realtime
// (Websockets) — die App ist Single-User/meist Single-Tab, daher reicht ein
// rein lokaler In-Memory-Bus für die bestehende "Daten ändern sich, UI
// aktualisiert sich automatisch"-UX.

type Listener = () => void

const listeners = new Map<string, Set<Listener>>()

export function subscribe(table: string, cb: Listener): () => void {
  let set = listeners.get(table)
  if (!set) {
    set = new Set()
    listeners.set(table, set)
  }
  set.add(cb)
  return () => {
    set?.delete(cb)
  }
}

export function notify(...tables: string[]): void {
  for (const table of tables) {
    listeners.get(table)?.forEach((cb) => cb())
  }
}
