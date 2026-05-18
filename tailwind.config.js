/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/main/resources/static/**/*.html',
    './src/main/resources/static/**/*.js',
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        cormorant: ['Cormorant Garamond', 'serif'],
      },
      colors: {
        ink: '#1E2820',
        muted: '#6B6860',
        cream: '#FFF8FB',
        cream2: '#F5F2EE',
        cream3: '#F0EDE8',
        line: '#E8E4DE',
        sage: '#3D6B45',
        sage2: '#2C4A30',
        mint: '#C2E0C6',
        gold: '#C2A882',
      },
    },
  },
};
