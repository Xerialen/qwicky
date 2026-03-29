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
          // Zinc mono — minimal dark palette
          'dark':    '#18181B',   // primary surface
          'darker':  '#09090B',   // app background
          'panel':   '#18181B',   // card surface (same as dark — panels blend)
          'border':  '#27272A',   // subtle dividers, used sparingly

          // Accent — quiet violet
          'accent':        '#A78BFA',
          'accent-dim':    '#8B5CF6',
          'accent-bright': '#C4B5FD',

          // Utility blue
          'blue':     '#7DD3FC',
          'blue-dim': '#60A5FA',

          // Status — desaturated
          'win':  '#4ADE80',
          'loss': '#F87171',
          'draw': '#A78BFA',

          // Text hierarchy
          'text':   '#FAFAFA',
          'muted':  '#A1A1AA',
          'bright': '#FFFFFF',

          'highlight': '#A78BFA',
        }
      },
      fontFamily: {
        'display': ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        'body':    ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        'mono':    ['"JetBrains Mono"', 'ui-monospace', 'Consolas', 'monospace'],
        'logo':    ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      boxShadow: {
        'card':        'none',
        'card-hover':  '0 1px 3px rgba(0,0,0,0.3)',
        'input-focus': '0 0 0 1px rgba(167,139,250,0.4)',
      },
      borderRadius: {
        'DEFAULT': '6px',
      },
      animation: {
        'slide-up': 'slide-up 0.2s ease-out',
        'fade-in':  'fade-in  0.15s ease-out',
      },
      keyframes: {
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
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
