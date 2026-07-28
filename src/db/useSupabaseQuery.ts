import { useCallback, useEffect, useRef, useState } from 'react'
import { subscribe } from './queryBus'

/**
 * Ersatz für Dexies `useLiveQuery`: lädt `fetcher()` initial, sowie erneut
 * sobald eine der in `tables` genannten Tabellen via `notify()` als geändert
 * gemeldet wird (siehe queryBus.ts), oder sich eine der `deps` ändert.
 *
 * Gibt `undefined` zurück, solange noch nicht geladen wurde (analog zu
 * useLiveQuery, das vor dem ersten Ergebnis ebenfalls `undefined` liefert).
 */
export function useSupabaseQuery<T>(
  tables: string[],
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): T | undefined {
  const [data, setData] = useState<T | undefined>(undefined)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const tablesKey = tables.join(',')

  const load = useCallback(() => {
    fetcherRef.current()
      .then(setData)
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('useSupabaseQuery: Laden fehlgeschlagen', err)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const tableList = tablesKey ? tablesKey.split(',') : []
    const unsubs = tableList.map((t) => subscribe(t, load))
    return () => unsubs.forEach((u) => u())
  }, [tablesKey, load])

  return data
}
