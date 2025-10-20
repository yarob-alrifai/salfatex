/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{html,ts}', // Scan all HTML and TypeScript files in src/
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        accent: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
        neutral: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5f5',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
      },
      fontFamily: {
        sans: [
          'Tajawal',
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
        display: [
          'Tajawal',
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
      boxShadow: {
        brand: '0 22px 45px -20px rgba(79, 70, 229, 0.45)',
        soft: '0 18px 50px -30px rgba(15, 23, 42, 0.25)',
        card: '0 18px 55px -35px rgba(15, 23, 42, 0.35)',
      },
      borderRadius: {
        '3xl': '1.75rem',
        '4xl': '2.5rem',
      },
      backgroundImage: {
        'mesh-soft':
          'radial-gradient(circle at 15% 30%, rgba(99, 102, 241, 0.18), transparent 55%), radial-gradient(circle at 85% 20%, rgba(14, 165, 233, 0.18), transparent 45%), radial-gradient(circle at 50% 90%, rgba(79, 70, 229, 0.12), transparent 50%)',
      },
    },
  },
  plugins: [],
};
