import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      container: {
        screens: {
          '2xl': '100rem',
        },
      },
      colors: {
        'focus-blue': '#2563EB',
      },
    },
  },
  plugins: [],
}
export default config
