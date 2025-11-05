/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./frontend/src/**/*.{html,js,jsx,ts,tsx}", // your actual React source
    "./frontend/src/index.html",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  darkMode: "class", // optional
};
