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

export const TimerIcon = (props: IconProps): ReactElement => (
  <svg {...baseProps} {...props}>
    <circle cx="8" cy="8.5" r="5.25" />
    <path d="M8 8.5V5.5" />
    <path d="M8 8.5 10.4 9.9" />
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
    <path d="M4 5.4h5.9v2.8A2.3 2.3 0 0 1 7.6 10.5H6.3A2.3 2.3 0 0 1 4 8.2Z" />
    <path d="M9.9 6h1a1.3 1.3 0 1 1 0 2.6h-1" />
    <path d="M3.5 12.3h8" />
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
