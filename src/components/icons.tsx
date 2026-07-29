// Schlichte Linien-Icons (24×24, currentColor) für den Homescreen und
// globalen Header — bewusst keine Emojis, passend zum dunklen UI. Alle
// Icons teilen dieselben Stroke-Defaults, damit sie optisch einheitlich
// wirken, egal wo sie eingesetzt werden.
import type { SVGProps } from 'react'

function Svg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  )
}

// KVAs offen
export function DocumentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
      <path d="M8 12h8M8 16h5" />
    </Svg>
  )
}

// Rechnungen offen
export function LetterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x={3} y={5} width={18} height={14} rx={1.5} />
      <path d="m4 6.5 8 6 8-6" />
    </Svg>
  )
}

// Aktive Projekte
export function FolderIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Z" />
    </Svg>
  )
}

// Zeiterfassung
export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <circle cx={12} cy={12} r={9} />
      <path d="M12 7v5l3.5 2" />
    </Svg>
  )
}

// Fokus & To-Do
export function CheckboxIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x={4} y={4} width={16} height={16} rx={3} />
      <path d="m8 12 2.5 2.5L16 9" />
    </Svg>
  )
}

// Bewerbungen
export function BriefcaseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...props}>
      <rect x={3} y={8} width={18} height={12} rx={1.5} />
      <path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </Svg>
  )
}

// Fokusmusik (Header-Toggle)
export function SpeakerIcon({ an, ...props }: SVGProps<SVGSVGElement> & { an?: boolean }) {
  return (
    <Svg {...props}>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      {an && <path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" />}
      {!an && <path d="m16.5 9.5 4 4m0-4-4 4" />}
    </Svg>
  )
}
