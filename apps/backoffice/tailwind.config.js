/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#6042DE", dark: "#4930AF", light: "#EEE9FC" },
      },
    },
  },
  plugins: [],
};
