/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'qw': {
          // Modern Dark Mode palette
          'dark':    '#121212',   // app background
          'darker':  '#0F0F0F',   // deepest nesting level
          'panel':   '#1E1E2E',   // card / container surfaces
          'border':  '#2A2A3C',   // borders + inactive-tab fill

          // Accent — Deep Amber / Gold
          'accent':        '#FFB300',
          'accent-dim':    '#E6A200',
          'accent-bright': '#FFC933',

          // Subdued blue (losers-bracket connectors, hover states)
          'blue':     '#6B9BFF',
          'blue-dim': '#5A8AE6',

          // Status
          'win':  '#00FF88',
          'loss': '#FF3366',
          'draw': '#FFB300',

          // Text hierarchy
          'text':   '#E0E0E0',   // primary
          'muted':  '#A0A0B0',   // secondary / labels
          'bright': '#FFFFFF',

          // Alias kept for any legacy references
          'highlight': '#FFB300',
        }
      },
      fontFamily: {
        // Everything in the UI uses Inter …
        'display': ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        'body':    ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        'mono':    ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
        // … except the QW logo badge
        'logo':    ['Orbitron', 'sans-serif'],
      },
      boxShadow: {
        'card':        '0 2px 8px  rgba(0,0,0,0.25)',
        'card-hover':  '0 4px 16px rgba(0,0,0,0.35)',
        'input-focus': '0 0 0 2px  rgba(255,179,0,0.3)',
      },
      animation: {
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in':  'fade-in  0.2s ease-out',
      },
      keyframes: {
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)'   },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
