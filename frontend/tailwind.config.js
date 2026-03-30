/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "cliniq-teal": "#0C8D86",
        "cliniq-cyan": "#0FB7B0",
        "cliniq-red": "#D7263D",
        "cliniq-slate": "#12343B",
      },
      animation: {
        pulsecritical: "pulsecritical 1s infinite",
      },
      keyframes: {
        pulsecritical: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
      },
    },
  },
  plugins: [],
};
