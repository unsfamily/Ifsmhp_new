/** @type {import('tailwindcss').Config} */

/*
 * PROVISIONAL DESIGN TOKENS
 *
 * Spec §47 pins the direction: professional, international, academic,
 * scientific, trustworthy, modern, accessible — explicitly not playful
 * startup. These tokens honour that direction, but the brand assets
 * (logo, approved palette, licensed typefaces) are still outstanding
 * (architecture §J.3-12), so every value below is a placeholder to be
 * replaced in Milestone 7, not an invented brand.
 *
 * The logo establishes a deep leaf-green identity. The palette keeps that
 * green authoritative in navigation and hero surfaces, with lighter greens
 * for interactive states and a muted olive accent for credentials.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#17251A',
          muted: '#405046',
          subtle: '#718078',
        },
        forum: {
          50: '#EEF7EC',
          100: '#D7EAD2',
          200: '#B2D2AA',
          400: '#4F9446',
          600: '#28751B',
          700: '#1F5D16',
          800: '#174A11',
          900: '#123B0E',
          950: '#0B2808',
        },
        slateteal: {
          100: '#E0F0DE',
          500: '#4B8F4A',
          700: '#326D35',
        },
        brass: {
          100: '#E3F1D8',
          500: '#5A9A35',
          700: '#3F7825',
        },
        paper: {
          DEFAULT: '#F6F9F4',
          raised: '#FFFFFF',
          border: '#DCE7D9',
        },
        danger: { 100: '#FBE3E3', 600: '#A32B2B' },
        success: { 100: '#DFF1E6', 600: '#1F6B41' },
        warning: { 100: '#FBEFD6', 600: '#8A6212' },
      },
      fontFamily: {
        // Provisional stacks. Licensed brand faces replace these in M7.
        display: ['"Source Serif 4"', 'Charter', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      maxWidth: {
        prose: '68ch',
      },
    },
  },
  plugins: [],
};
