/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Verdict colors — these are the primary visual language of the product
        verdict: {
          won: {
            bg: '#052e16',
            border: '#166534',
            text: '#4ade80',
            badge: '#14532d',
          },
          at_risk: {
            bg: '#422006',
            border: '#92400e',
            text: '#fbbf24',
            badge: '#78350f',
          },
          lost: {
            bg: '#1c0a09',
            border: '#991b1b',
            text: '#f87171',
            badge: '#7f1d1d',
          },
        },
      },
    },
  },
  plugins: [],
}
