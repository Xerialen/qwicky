/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // ... resten av koden är samma ...
  theme: {
    extend: {
      colors: {
        'qw': {
          // Base palette - Obsidian/Charcoal
          'dark': '#0d0f14',
          'darker': '#08090d',
          'panel': '#14171f',
          'border': '#1c2029',
          
          // Neon Amber accent
          'accent': '#FFB100',
          'accent-dim': '#CC8E00',
          'accent-bright': '#FFD54F',
          
          // Neon Blue secondary
          'blue': '#00F3FF',
          'blue-dim': '#00C4CC',
          
          // Status colors - more neon
          'win': '#00FF88',
          'loss': '#FF3366',
          'draw': '#FFB100',
          
          // Text hierarchy
          'text': '#E8EAF0',
          'muted': '#8891A5',
          'bright': '#FFFFFF',
          
          // Legacy compatibility
          'highlight': '#FFB100',
        }
      },
      fontFamily: {
        'display': ['Orbitron', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Fira Code', 'Roboto Mono', 'monospace'],
        'body': ['Rajdhani', 'sans-serif'],
      },
      borderRadius: {
        'none': '0',
        'cyber': '0', // Enforce hard edges
      },
      boxShadow: {
        'neon-amber': '0 0 5px #FFB100, 0 0 20px rgba(255, 177, 0, 0.4)',
        'neon-amber-lg': '0 0 10px #FFB100, 0 0 40px rgba(255, 177, 0, 0.4), 0 0 80px rgba(255, 177, 0, 0.2)',
        'neon-blue': '0 0 5px #00F3FF, 0 0 20px rgba(0, 243, 255, 0.4)',
        'neon-blue-lg': '0 0 10px #00F3FF, 0 0 40px rgba(0, 243, 255, 0.4), 0 0 80px rgba(0, 243, 255, 0.2)',
        'neon-green': '0 0 5px #00FF88, 0 0 20px rgba(0, 255, 136, 0.4)',
        'neon-red': '0 0 5px #FF3366, 0 0 20px rgba(255, 51, 102, 0.4)',
        'inner-glow': 'inset 0 0 20px rgba(255, 177, 0, 0.1)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'glitch': 'glitch 0.3s ease',
        'scanline': 'scanline-move 6s linear infinite',
        'flicker': 'crt-flicker 0.1s ease-in-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { 
            boxShadow: '0 0 5px rgba(255, 177, 0, 0.3)' 
          },
          '50%': { 
            boxShadow: '0 0 25px rgba(255, 177, 0, 0.6), 0 0 50px rgba(255, 177, 0, 0.3)' 
          },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'glitch': {
          '0%, 100%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(-2px, -2px)' },
          '60%': { transform: 'translate(2px, 2px)' },
          '80%': { transform: 'translate(2px, -2px)' },
        },
        'scanline-move': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'crt-flicker': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
          '75%': { opacity: '0.95' },
        },
      },
      letterSpacing: {
        'cyber': '0.15em',
        'cyber-wide': '0.25em',
      },
      fontSize: {
        'cyber-xs': ['0.7rem', { letterSpacing: '0.1em', lineHeight: '1.5' }],
        'cyber-sm': ['0.8rem', { letterSpacing: '0.08em', lineHeight: '1.5' }],
        'cyber-base': ['0.9rem', { letterSpacing: '0.05em', lineHeight: '1.6' }],
      },
    },
  },
  plugins: [],
}
