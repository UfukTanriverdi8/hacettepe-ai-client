/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
          fontFamily: {
              sans: ['Inter', 'sans-serif'],
            }
        },
        colors:{
            "primary": "#050609",
            "secondary": "#b72e2e",
            "tertiary": "#EDF2F4",
            "black": "#1c1c1c",
            "secondary-red": "#b5172f",
            "white-text": "#ffffff",
        }
    },
    plugins: [],
  }