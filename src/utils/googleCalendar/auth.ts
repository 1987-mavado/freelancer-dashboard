const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

let gisScriptPromise: Promise<void> | null = null
// Ein Token wird pro (clientId, scope)-Kombination zwischengespeichert, damit
// z.B. ein Gmail-Send-Token (siehe utils/gmail/send.ts) das bestehende
// Kalender-Token nicht überschreibt und umgekehrt.
let cachedToken: { clientId: string; scope: string; accessToken: string; expiresAt: number } | null = null

function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gisScriptPromise) return gisScriptPromise

  gisScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Identity Services konnte nicht geladen werden.'))
    document.head.appendChild(script)
  })
  return gisScriptPromise
}

/**
 * Liefert einen bereits im Speicher zwischengespeicherten Access-Token,
 * ohne selbst einen (ggf. interaktiven, Popup-öffnenden) OAuth-Flow
 * auszulösen. Für passive Lesezugriffe (z. B. das Kalender-Widget auf der
 * Fokus-Seite), die nicht ungefragt ein Google-Consent-Popup aufreißen
 * sollen — nur nach einem manuellen "Verbinden & synchronisieren" (das
 * `getAccessToken` aufruft) ist hier ein gültiger Token vorhanden.
 */
export function getCachedAccessToken(clientId: string, scope: string = CALENDAR_SCOPE): string | null {
  const now = Date.now()
  if (
    cachedToken &&
    cachedToken.clientId === clientId &&
    cachedToken.scope === scope &&
    cachedToken.expiresAt > now + 30_000
  ) {
    return cachedToken.accessToken
  }
  return null
}

export async function getAccessToken(clientId: string, scope: string = CALENDAR_SCOPE): Promise<string> {
  if (!clientId.trim()) throw new Error('Keine Google Client-ID hinterlegt.')

  const cached = getCachedAccessToken(clientId, scope)
  if (cached) return cached

  await loadGisScript()
  const google = window.google
  if (!google?.accounts?.oauth2) throw new Error('Google Identity Services ist nicht verfügbar.')

  return new Promise<string>((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error))
          return
        }
        cachedToken = {
          clientId,
          scope,
          accessToken: response.access_token,
          expiresAt: Date.now() + response.expires_in * 1000,
        }
        resolve(response.access_token)
      },
      error_callback: (error) => {
        reject(new Error(error.message || `Google-Anmeldung fehlgeschlagen (${error.type}).`))
      },
    })
    tokenClient.requestAccessToken(undefined)
  })
}
