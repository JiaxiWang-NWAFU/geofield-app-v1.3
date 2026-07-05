/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        earth: {
          50: '#fdf8f0',
          100: '#f5ead6',
          200: '#ebd5ad',
          300: '#d4b77a',
          400: '#c49a4f',
          500: '#a67c3b',
          600: '#8b6430',
          700: '#6f4e28',
          800: '#5a3f23',
          900: '#4a3420',
        },
      },
    },
  },
  plugins: [],
};
