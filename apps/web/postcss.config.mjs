/**
 * Tailwind v4 moved its PostCSS plugin into its own package. Using
 * `tailwindcss` directly here is the v3 pattern and will error.
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
