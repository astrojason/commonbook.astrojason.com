/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      colors: {
        ink: {
          DEFAULT: '#0E0C09',
          2: '#161310',
          3: '#1C1814',
        },
        rule: {
          DEFAULT: '#26211B',
          2: '#332D25',
        },
        muted: '#A7A095',
        dim: '#8A7F73',
        accent: {
          DEFAULT: '#E2602B',
          dim: '#8a3a18',
        },
      },
    },
  },
  plugins: [],
}
