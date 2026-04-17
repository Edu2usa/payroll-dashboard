/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#1E40AF',
          'primary-hover': '#1E3A8A',
          secondary: '#3B82F6',
          cta: '#F59E0B',
          'cta-hover': '#D97706',
          bg: '#F8FAFC',
          heading: '#1E3A8A',
        },
      },
      fontFamily: {
        sans: ['var(--font-fira-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-fira-code)', 'ui-monospace', 'monospace'],
        heading: ['var(--font-fira-code)', 'ui-monospace', 'monospace'],
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
    },
  },
  plugins: [],
}
