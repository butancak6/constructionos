/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#007AFF',
        'primary-dark': '#1E40AF',
        secondary: '#F1F5F9',
        surface: '#FFFFFF',
        'text-main': '#0F172A',
        'text-muted': '#64748B',
        "background-light": "#F2F7FF",
        "background-dark": "#0A0A0C",
        card: {
            light: "#FFFFFF",
            dark: "#1C1C1E"
        }
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
