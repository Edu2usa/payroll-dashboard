/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        pm: {
          ink: '#1d2128',
          surface: '#ffffff',
          canvas: '#f6f4f5',
          muted: '#565f6c',
          line: '#d9d6d8',
          brand: '#cc2434',
          brandDark: '#a61a27',
          brandSoft: '#fbe9eb',
          brandGlow: '#f6d3d8',
          charcoal: '#241920',
          charcoalSoft: '#312126',
        },
      },
      fontFamily: {
        sans: ['"Source Sans 3"', '"Segoe UI"', 'sans-serif'],
        display: ['Sora', '"Trebuchet MS"', 'sans-serif'],
      },
      boxShadow: {
        brand: '0 14px 30px rgba(29, 33, 40, 0.12)',
      },
    },
  },
  plugins: [],
}
