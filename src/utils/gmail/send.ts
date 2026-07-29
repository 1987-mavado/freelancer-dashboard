import { getAccessToken } from '../googleCalendar/auth'

const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send'

export interface EmailAttachment {
  filename: string
  mimeType: string
  base64: string
}

export interface SendEmailInput {
  to: string
  subject: string
  body: string
  attachment?: EmailAttachment
}

// Base64url statt normalem Base64 — von der Gmail-API für das "raw"-Feld
// vorgeschrieben (RFC 4648 §5).
function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function buildMimeMessage(input: SendEmailInput): string {
  const boundary = `----=_Boundary_${Date.now()}`
  const subjectEncoded = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(input.subject)))}?=`

  const lines = [
    `To: ${input.to}`,
    `Subject: ${subjectEncoded}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    btoa(unescape(encodeURIComponent(input.body))),
    '',
  ]

  if (input.attachment) {
    lines.push(
      `--${boundary}`,
      `Content-Type: ${input.attachment.mimeType}; name="${input.attachment.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${input.attachment.filename}"`,
      '',
      input.attachment.base64,
      '',
    )
  }

  lines.push(`--${boundary}--`)
  return lines.join('\r\n')
}

// Versendet eine E-Mail über die Gmail-API (client-seitig, gleiches
// OAuth-Prinzip wie der Google-Kalender-Sync — kein eigenes Backend nötig).
// Erfordert in der Google-Cloud-Konsole zusätzlich zum Kalender-Scope den
// Scope "gmail.send" für die hinterlegte Client-ID sowie die aktivierte
// Gmail API.
export async function sendGmail(clientId: string, input: SendEmailInput): Promise<void> {
  const accessToken = await getAccessToken(clientId, GMAIL_SEND_SCOPE)
  const raw = toBase64Url(btoa(unescape(encodeURIComponent(buildMimeMessage(input)))))

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gmail-Versand fehlgeschlagen (${res.status}): ${text}`)
  }
}
