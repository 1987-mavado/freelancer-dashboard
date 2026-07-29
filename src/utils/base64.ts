// Wandelt Binärdaten (z.B. einen erzeugten PDF-Buffer) in einen normalen
// Base64-String um — in Chunks, damit `String.fromCharCode(...bytes)` bei
// großen Dateien nicht am Aufrufstapel-Limit scheitert.
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}
