/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F7F9FC',
        ink: '#0B1F3A',
        muted: '#5A6B82',
        line: '#D7E0EC',
        teal: {
          DEFAULT: '#0D9488',
          dark: '#0F766E',
          light: '#CCFBF1'
        },
        warn: '#B45309',
        danger: '#BE123C'
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif']
      },
      boxShadow: {
        card: '0 1px 2px rgba(11, 31, 58, 0.06), 0 8px 24px rgba(11, 31, 58, 0.06)'
      }
    }
  },
  plugins: []
}
