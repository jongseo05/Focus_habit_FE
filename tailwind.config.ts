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
    },
  },
  plugins: [],
}
export default config
