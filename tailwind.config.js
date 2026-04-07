/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Material Design 3 dynamic color tokens — amber/industrial palette
        'primary':                '#ffc485',
        'on-primary':             '#482900',
        'primary-container':      '#ff9d00',
        'on-primary-container':   '#663c00',
        'primary-fixed':          '#ffdcbb',
        'primary-fixed-dim':      '#ffb869',
        'on-primary-fixed':       '#2c1700',
        'on-primary-fixed-variant': '#673d00',

        'secondary':              '#f5bc73',
        'on-secondary':           '#462b00',
        'secondary-container':    '#6a4301',
        'on-secondary-container': '#e9b269',
        'secondary-fixed':        '#ffddb6',
        'secondary-fixed-dim':    '#f5bc73',
        'on-secondary-fixed':     '#2a1800',
        'on-secondary-fixed-variant': '#643f00',

        'tertiary':               '#b9d99d',
        'on-tertiary':            '#1e370b',
        'tertiary-container':     '#9ebd83',
        'on-tertiary-container':  '#324c1f',
        'tertiary-fixed':         '#ccedaf',
        'tertiary-fixed-dim':     '#b0d095',
        'on-tertiary-fixed':      '#0b2000',
        'on-tertiary-fixed-variant': '#344e20',

        'error':                  '#ffb4ab',
        'on-error':               '#690005',
        'error-container':        '#93000a',
        'on-error-container':     '#ffdad6',

        'surface':                '#131313',
        'on-surface':             '#e4e2e1',
        'surface-dim':            '#131313',
        'surface-bright':         '#393939',
        'surface-variant':        '#353535',
        'on-surface-variant':     '#dac2ad',
        'surface-container-lowest':  '#0e0e0e',
        'surface-container-low':     '#1b1c1c',
        'surface-container':         '#1f2020',
        'surface-container-high':    '#2a2a2a',
        'surface-container-highest': '#353535',
        'surface-tint':              '#ffb869',

        'outline':                '#a28d79',
        'outline-variant':        '#544433',

        'background':             '#131313',
        'on-background':          '#e4e2e1',

        'inverse-surface':        '#e4e2e1',
        'inverse-on-surface':     '#303030',
        'inverse-primary':        '#885200',

        // Legacy compat aliases (used in existing components)
        'qw': {
          'dark':          '#1f2020',
          'darker':        '#131313',
          'panel':         '#2a2a2a',
          'border':        '#544433',
          'accent':        '#ffc485',
          'accent-dim':    '#ff9d00',
          'accent-bright': '#ffdcbb',
          'blue':          '#7DD3FC',
          'blue-dim':      '#60A5FA',
          'win':           '#b9d99d',
          'loss':          '#ffb4ab',
          'draw':          '#f5bc73',
          'text':          '#e4e2e1',
          'muted':         '#dac2ad',
          'bright':        '#FFFFFF',
          'highlight':     '#ffc485',
        },
      },
      fontFamily: {
        'headline': ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        'body':     ['"Inter"', 'system-ui', 'sans-serif'],
        'mono':     ['"Fira Code"', 'ui-monospace', 'Consolas', 'monospace'],
        'label':    ['"Inter"', 'system-ui', 'sans-serif'],
        // Legacy aliases
        'display':  ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        'logo':     ['"Space Grotesk"', 'sans-serif'],
      },
      boxShadow: {
        'card':        'none',
        'card-hover':  '0 1px 3px rgba(0,0,0,0.3)',
        'input-focus': '0 0 0 1px rgba(255,196,133,0.4)',
        'heat':        '0 4px 20px -4px rgba(255,157,0,0.4)',
      },
      borderRadius: {
        'DEFAULT': '0.125rem',
        'lg':      '0.25rem',
        'xl':      '0.5rem',
        'full':    '0.75rem',
      },
      animation: {
        'slide-up':   'slide-up 0.2s ease-out',
        'fade-in':    'fade-in  0.15s ease-out',
        'spin-slow':  'spin 4s linear infinite',
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
