import { kvasRepo, projekteRepo } from '../db/repo'
import { generateJobnummer } from './projekt'
import type { Kva } from '../db/types'

// KVA annehmen (einfacher Flow, kein Ressourcentool mehr): Projekt wird
// direkt abrechenbar (status "aktiv") und bekommt, falls noch keine
// Jobnummer vergeben ist, automatisch eine — der in der Zeiterfassung/
// Fokus-Seite Stunden zugeordnet werden können. Wiederverwendet von
// KvaDetail.tsx (Detailseite) und KvaList.tsx (Listen-Häkchen).
export async function kvaAnnehmen(kva: Kva & { id: number }): Promise<void> {
  await kvasRepo.put({ ...kva, status: 'angenommen' })
  const projekt = await projekteRepo.get(kva.projektId)
  if (!projekt) return
  const patch: { status?: 'aktiv'; nummer?: string } = {}
  if (projekt.status !== 'aktiv') patch.status = 'aktiv'
  if (!projekt.nummer.trim()) patch.nummer = await generateJobnummer(projekt)
  if (Object.keys(patch).length > 0) await projekteRepo.update(kva.projektId, patch)
}
