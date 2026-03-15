/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0d1117',
        surface: '#161b22',
        accent: '#00d4aa',
        pending: '#ef4444',
        inprogress: '#f59e0b',
        resolved: '#10b981',
      },
      fontFamily: {
        heading: ['Epilogue', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      animation: {
        'drop': 'drop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
      },
      keyframes: {
        drop: {
          '0%': { transform: 'translateY(-20px) scale(0)', opacity: 0 },
          '100%': { transform: 'translateY(0) scale(1)', opacity: 1 },
        }
      }
    },
  },
  plugins: [],
}
