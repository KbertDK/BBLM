import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bb-navy':          '#0d0d1a',
        'bb-dark':          '#12121f',
        'bb-darker':        '#0a0a14',
        'bb-gold':          '#c9a227',
        'bb-gold-dim':      '#a07d1c',
        'bb-crimson':       '#8b0000',
        'bb-crimson-bright':'#c0392b',
        'bb-muted':         '#6b7280',
        'bb-border':        '#1e1e3a',
      },
      fontFamily: {
        heading: ['var(--font-cinzel)', 'Georgia', 'serif'],
        body:    ['var(--font-inter)',  'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-live': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      backgroundImage: {
        'grimdark-gradient': 'linear-gradient(180deg, #0d0d1a 0%, #12121f 100%)',
      },
    },
  },
  plugins: [],
}

export default config
