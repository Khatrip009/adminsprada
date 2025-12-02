/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        sprada1: "#F7D8B4",
        sprada2: "#1B3937",
        sprada3: "#1A6560",
        sprada4: "#BB7521",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      keyframes: {
        floaty: {
          "0%": { transform: "translateY(0px) rotate(0deg)" },
          "50%": { transform: "translateY(-14px) rotate(3deg)" },
          "100%": { transform: "translateY(0px) rotate(0deg)" }
        },
        fadeInUp: {
          "0%": { opacity: 0, transform: "translateY(20px)" },
          "100%": { opacity: 1, transform: "translateY(0)" }
        }
      },
      animation: {
        floaty: "floaty 12s ease-in-out infinite",
        floatySlow: "floaty 18s ease-in-out infinite",
        fadeInUp: "fadeInUp .65s ease-out forwards"
      }
    }
  },
  plugins: [],
}
