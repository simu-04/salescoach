'use client'
/**
 * ThemeToggle — animated sun/moon icon button.
 * Sits in the sidebar footer. One click flips the whole app.
 */
import { useTheme } from '@/components/ThemeProvider'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium transition-all"
      style={{
        background: 'var(--input-bg)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-secondary)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'
        e.currentTarget.style.color = 'var(--text-primary)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)'
        e.currentTarget.style.color = 'var(--text-secondary)'
      }}
    >
      {/* Track */}
      <div
        className="relative w-9 h-5 rounded-full flex-shrink-0 transition-all duration-300"
        style={{
          background: isDark
            ? 'rgba(99,102,241,0.3)'
            : 'rgba(99,102,241,0.7)',
          border: '1px solid rgba(99,102,241,0.4)',
        }}
      >
        {/* Thumb */}
        <div
          className="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-300 flex items-center justify-center text-[8px]"
          style={{
            left: isDark ? '2px' : '18px',
            background: isDark ? '#1e1b4b' : '#ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
        >
          {isDark ? '🌙' : '☀️'}
        </div>
      </div>

      <span className="text-xs">
        {isDark ? 'Dark mode' : 'Light mode'}
      </span>

      {/* Keyboard hint */}
      <span
        className="ml-auto text-[10px] px-1.5 py-0.5 rounded font-mono"
        style={{
          background: 'var(--tag-bg)',
          color: 'var(--text-faint)',
        }}
      >
        ⌘K
      </span>
    </button>
  )
}
