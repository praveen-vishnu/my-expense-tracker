import { IconMoon, IconSun } from '@tabler/icons-react'

export default function ThemeToggle({ theme, onToggle, className = '' }) {
  const isDark = theme === 'dark'
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme'

  return (
    <button
      type="button"
      className={`icon-btn theme-toggle ${className}`.trim()}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      onClick={onToggle}
    >
      {isDark
        ? <IconSun size={19} stroke={1.8} aria-hidden="true" />
        : <IconMoon size={19} stroke={1.8} aria-hidden="true" />}
    </button>
  )
}
