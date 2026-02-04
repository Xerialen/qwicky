/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'qw-darker': '#0a0a0f',
        'qw-dark': '#12121a',
        'qw-panel': '#1a1a24',
        'qw-border': '#2a2a3a',
        'qw-text': '#e0e0e0',
        'qw-muted': '#888899',
        'qw-accent': '#ffb100',
        'qw-win': '#00ff88',
        'qw-loss': '#ff4444',
        'qw-blue': '#4488ff',
      },
      fontFamily: {
        'display': ['Orbitron', 'sans-serif'],
        'body': ['Rajdhani', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
