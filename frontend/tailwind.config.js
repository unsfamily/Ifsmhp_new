/** @type {import('tailwindcss').Config} */

/*
 * BRAND DESIGN TOKENS — IFSMHP
 *
 * Palette (locked per brand guidance):
 *   Dark Blue   #012559   — primary / navigation / headings
 *   Gold        #C39D49   — accent / CTAs / highlights
 *   White       #FFFFFF   — main background / paper surfaces
 *
 * Semantic scale families map onto these three values so that existing
 * utility classes (forum-*, brass-*, paper-*, ink-*, slateteal-*)
 * resolve to the approved brand colours without a wholesale class rename
 * across every component.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#012559',
          muted: '#1E3E88',
          subtle: '#3556A5',
        },
        forum: {
          50: '#EEF2FB',
          100: '#D9E0F5',
          200: '#B3C2EB',
          400: '#5A78C2',
          500: '#3556A5',
          600: '#1E3E88',
          700: '#103070',
          800: '#082863',
          900: '#012559',
          950: '#001738',
        },
        slateteal: {
          50: '#EEF2FB',
          100: '#EEF2FB',
          200: '#B3C2EB',
          500: '#3556A5',
          600: '#1E3E88',
          700: '#103070',
          800: '#082863',
          900: '#012559',
          950: '#001738',
        },
        brass: {
          50: '#FBF6EA',
          100: '#F5EBCB',
          200: '#EBD89A',
          400: '#D8B65F',
          500: '#C39D49',
          600: '#A8823A',
          700: '#8A6930',
          800: '#6E5328',
          900: '#584220',
          950: '#3A2C16',
        },
        paper: {
          DEFAULT: '#FFFFFF',
          raised: '#FFFFFF',
          border: '#D9E0F5',
        },
        danger: { 50: '#FDF4F4', 100: '#FBE3E3', 600: '#A32B2B', 700: '#8A2222', 800: '#6E1B1B', 900: '#551414' },
        success: { 50: '#F3F9F5', 100: '#DFF1E6', 600: '#1F6B41', 700: '#185634', 800: '#124429', 900: '#0D3520' },
        warning: { 50: '#FDF9EF', 100: '#FBEFD6', 600: '#8A6212', 700: '#72500E', 800: '#5A3F0B', 900: '#463109' },
        info: { 500: '#3556A5', 600: '#1E3E88' },
      },
      fontFamily: {
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
