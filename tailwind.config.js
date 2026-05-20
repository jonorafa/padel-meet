/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        padel: {
          green: '#005C28',
          mid: '#2D7D4F',
          light: '#4DBD74',
          pale: '#E8F5EC',
          border: '#B8D4C0',
          beige: '#FAFAF7',
          card: '#FFFFFF',
          text: '#1A1A1A',
          muted: '#888888',
        },
      },
      fontFamily: {
        cursive: ['"Dancing Script"', 'cursive'],
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 24px rgba(0, 92, 40, 0.08)',
        'card-lg': '0 8px 40px rgba(0, 92, 40, 0.15)',
      },
    },
  },
  plugins: [],
}
