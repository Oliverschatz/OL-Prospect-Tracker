import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        msf: {
          navy: "#0B2545",
          steel: "#13315C",
          gold: "#C89F4B",
          mist: "#F5F7FA",
          slate: "#596273",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Source Serif 4", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
