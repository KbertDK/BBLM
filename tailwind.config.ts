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
      keyframes: {
        marquee: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'td-blast': {
          '0%':   { transform: 'scale(0.15)', opacity: '0' },
          '70%':  { transform: 'scale(1.05)', opacity: '1' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
        'td-fade-out': {
          '0%':   { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(1.08)' },
        },
      },
      animation: {
        'pulse-live':  'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'marquee':     'marquee 120s linear infinite',
        'td-blast':    'td-blast 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'td-fade-out': 'td-fade-out 0.5s ease-in forwards',
      },
      backgroundImage: {
        'grimdark-gradient': 'linear-gradient(180deg, #0d0d1a 0%, #12121f 100%)',
      },
    },
  },
  plugins: [],
}

export default config
