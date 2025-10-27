const colors = require('tailwindcss/colors')

module.exports = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // expose a primary token (based on indigo) and an accent token
        primary: colors.indigo,
        accent: colors.teal,
      }
    }
  },
  plugins: []
}
