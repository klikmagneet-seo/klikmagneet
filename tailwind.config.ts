import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebar: {
          bg: "#1e1e2e",
          hover: "#2a2a3e",
          active: "#3b3b52",
          text: "#a0a0b8",
          textActive: "#ffffff",
        },
      },
    },
  },
  plugins: [],
};
export default config;
