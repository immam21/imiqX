module.exports = {
  content: [
    './app/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
    './pages/**/*.{ts,tsx,js,jsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0F172A',
        accent: '#2563EB',
        'accent-dark': '#1d4ed8',
        'accent-soft': '#EFF6FF',
        success: '#10B981',
        danger: '#EF4444',
        warning: '#F59E0B',
        muted: '#64748B',
        border: '#E2E8F0',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        hover: '0 8px 32px rgba(0,0,0,0.10)',
        glow: '0 0 30px rgba(37,99,235,0.22)',
        'accent': '0 4px 14px rgba(37,99,235,0.35)',
      },
    }
  },
  plugins: []
}
