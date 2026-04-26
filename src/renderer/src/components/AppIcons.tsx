import type { ReactElement, SVGProps } from 'react'

interface IconProps extends SVGProps<SVGSVGElement> {
  className?: string
}

const baseProps = {
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false
}

const statsSummaryProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false
}

export const TimerIcon = (props: IconProps): ReactElement => (
  <svg {...baseProps} {...props}>
    <circle cx="8" cy="8" r="4.9" />
    <path d="M8 5.2v3.2" />
    <path d="m8 8.4 2.3 1.4" />
  </svg>
)

export const TasksIcon = (props: IconProps): ReactElement => (
  <svg {...baseProps} {...props}>
    <path d="M3 4.5H13" />
    <path d="M3 8H13" />
    <path d="M3 11.5H13" />
  </svg>
)

export const StatsIcon = (props: IconProps): ReactElement => (
  <svg {...baseProps} {...props}>
    <path d="M3 12.5H13" />
    <path d="M4.5 10V7.5" />
    <path d="M8 10V4.5" />
    <path d="M11.5 10V6" />
  </svg>
)

export const SettingsIcon = (props: IconProps): ReactElement => (
  <svg {...baseProps} {...props}>
    <circle cx="8" cy="8" r="2.1" />
    <path d="M8 2.6v1.5" />
    <path d="M8 11.9v1.5" />
    <path d="m4.2 4.2 1 1" />
    <path d="m10.8 10.8 1 1" />
    <path d="M2.6 8h1.5" />
    <path d="M11.9 8h1.5" />
    <path d="m4.2 11.8 1-1" />
    <path d="m10.8 5.2 1-1" />
  </svg>
)

export const ThemeIcon = (props: IconProps): ReactElement => (
  <svg {...baseProps} {...props}>
    <path d="M9.9 2.8A5.4 5.4 0 1 0 10.6 13 4.7 4.7 0 0 1 9.9 2.8Z" />
  </svg>
)

export const SunIcon = (props: IconProps): ReactElement => (
  <svg {...baseProps} {...props}>
    <circle cx="8" cy="8" r="2.4" />
    <path d="M8 1.9v1.8" />
    <path d="M8 12.3v1.8" />
    <path d="m3.7 3.7 1.3 1.3" />
    <path d="m11 11 1.3 1.3" />
    <path d="M1.9 8h1.8" />
    <path d="M12.3 8h1.8" />
    <path d="m3.7 12.3 1.3-1.3" />
    <path d="M11 5l1.3-1.3" />
  </svg>
)

export const MoonIcon = (props: IconProps): ReactElement => (
  <svg {...baseProps} {...props}>
    <path d="M10.1 2.5A5.5 5.5 0 1 0 12 11.1 4.9 4.9 0 0 1 10.1 2.5Z" />
  </svg>
)

export const ExitIcon = (props: IconProps): ReactElement => (
  <svg {...baseProps} {...props}>
    <path d="M6.2 3H3.8v10h2.4" />
    <path d="M8 8h4.6" />
    <path d="m10.8 5.8 2.2 2.2-2.2 2.2" />
  </svg>
)

export const MinimizeIcon = (props: IconProps): ReactElement => (
  <svg {...baseProps} {...props}>
    <path d="M3.2 8.8h9.6" />
  </svg>
)

export const MaximizeIcon = (props: IconProps): ReactElement => (
  <svg {...baseProps} {...props}>
    <rect x="3.3" y="3.3" width="9.4" height="9.4" />
  </svg>
)

export const CloseIcon = (props: IconProps): ReactElement => (
  <svg {...baseProps} {...props}>
    <path d="m4 4 8 8" />
    <path d="m12 4-8 8" />
  </svg>
)

export const ActionArrowIcon = (props: IconProps): ReactElement => (
  <svg {...baseProps} {...props}>
    <path d="M3.5 8H12" />
    <path d="m8.8 4.6 3.2 3.4-3.2 3.4" />
  </svg>
)

export const PlayControlIcon = (props: IconProps): ReactElement => (
  <svg {...baseProps} {...props} fill="currentColor" stroke="none">
    <path d="M4.8 3.2v9.6L12.4 8 4.8 3.2Z" />
  </svg>
)

export const PauseControlIcon = (props: IconProps): ReactElement => (
  <svg {...baseProps} {...props}>
    <path d="M5.4 4.2v7.6" />
    <path d="M10.6 4.2v7.6" />
  </svg>
)

export const SkipNextIcon = (props: IconProps): ReactElement => (
  <svg {...baseProps} {...props}>
    <path d="M4.2 4.5v7" />
    <path d="m6.2 4.9 4.5 3.1-4.5 3.1z" />
  </svg>
)

export const CoffeeCupIcon = (props: IconProps): ReactElement => (
  <svg {...baseProps} {...props}>
    <path d="M4.2 6.1h6.1v2.3a2.5 2.5 0 0 1-2.5 2.5H6.7a2.5 2.5 0 0 1-2.5-2.5Z" />
    <path d="M10.3 6.7H11a1.4 1.4 0 1 1 0 2.8h-.7" />
    <path d="M5.9 4.1v1.3" />
    <path d="M8.1 3.7V5" />
    <path d="M3.6 12.2h8.2" />
  </svg>
)

export const LoungeChairIcon = (props: IconProps): ReactElement => (
  <svg {...baseProps} {...props}>
    <path d="M2.8 10.8h10.4" />
    <path d="M4 10.8V9.5a1.2 1.2 0 0 1 1.2-1.2h2.2a2 2 0 0 0 1.7-.9l1.2-1.9" />
    <path d="M4 10.8 3.2 7.8A1.5 1.5 0 0 1 4.7 6h.9a1.7 1.7 0 0 1 1.6 1.1L7.8 8.8" />
    <path d="M4 10.8v1.4" />
    <path d="M11.8 10.8v1.4" />
  </svg>
)

export const RocketIcon = (props: IconProps): ReactElement => (
  <svg {...baseProps} {...props}>
    <path d="M9.2 3.1c1.8.2 3.4 1.8 3.7 3.6-.9 1.8-2.4 3.5-4.6 5.1-1.2-.4-2.1-1.3-2.5-2.5 1.6-2.1 3.3-3.7 5.1-4.6Z" />
    <circle cx="9.2" cy="6.6" r="1" />
    <path d="m5.6 8.8-2 1 .9-2.2 1.7-.4" />
    <path d="m8.5 11.7-.4 1.8 1.7-.9.5-1.7" />
    <path d="m4.6 10.6 1.2.2.2 1.2-1.6.8z" />
  </svg>
)

export const ClipboardCheckIcon = (props: IconProps): ReactElement => (
  <svg {...baseProps} {...props}>
    <rect x="4.2" y="3.4" width="7.6" height="9.6" rx="1.5" />
    <path d="M6.2 3.4h3.6v1.5H6.2z" />
    <path d="m6.4 8.2 1.2 1.2 2.3-2.5" />
  </svg>
)

export const StatsSummaryClockIcon = (props: IconProps): ReactElement => (
  <svg {...statsSummaryProps} {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6h4" />
  </svg>
)

export const StatsSummaryRocketIcon = (props: IconProps): ReactElement => (
  <svg {...statsSummaryProps} {...props}>
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09" />
    <path d="M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05" />
  </svg>
)

export const StatsSummaryClipboardIcon = (props: IconProps): ReactElement => (
  <svg {...statsSummaryProps} {...props}>
    <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="m9 14 2 2 4-4" />
  </svg>
)

export const StatsSummaryCupIcon = (props: IconProps): ReactElement => (
  <svg {...statsSummaryProps} {...props}>
    <path d="M10 2v2" />
    <path d="M14 2v2" />
    <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
    <path d="M6 2v2" />
  </svg>
)
