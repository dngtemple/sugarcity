/** Sugar City design system — keep client/ and admin/ copies identical to this file. */
/** @type {import('tailwindcss').Config} */
const c = (name) => `rgb(var(--sc-${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      colors: {
        cream: { DEFAULT: c('cream'), deep: c('cream-deep') },
        card: c('card'),
        cocoa: { DEFAULT: c('cocoa'), soft: c('cocoa-soft'), faint: c('cocoa-faint') },
        crumb: { DEFAULT: c('crumb'), strong: c('crumb-strong') },
        plum: {
          50: c('plum-50'),
          100: c('plum-100'),
          200: c('plum-200'),
          DEFAULT: c('plum'),
          700: c('plum-700'),
          900: c('plum-900'),
        },
        cherry: { 50: c('cherry-50'), DEFAULT: c('cherry'), 700: c('cherry-700') },
        peach: { 50: c('peach-50'), DEFAULT: c('peach'), 700: c('peach-700') },
        mint: { 50: c('mint-50'), DEFAULT: c('mint'), 700: c('mint-700') },
        honey: { 50: c('honey-50'), 200: c('honey-200'), 700: c('honey-700') },
        berry: { 50: c('berry-50'), DEFAULT: c('berry'), 700: c('berry-700') },
        sky: { 50: c('sky-50'), 700: c('sky-700') },
      },
      borderRadius: {
        sm: '10px',
        md: '16px',
        lg: '22px',
        xl: '28px',
        '2xl': '36px',
      },
      boxShadow: {
        soft: '0 1px 2px rgb(94 14 78 / 0.05), 0 4px 14px rgb(94 14 78 / 0.06)',
        lift: '0 24px 60px -18px rgb(94 14 78 / 0.35), 0 4px 12px rgb(94 14 78 / 0.08)',
        ring: '0 0 0 4px rgb(94 14 78 / 0.12)',
      },
      keyframes: {
        'rise': { from: { opacity: 0, transform: 'translateY(14px)' }, to: { opacity: 1, transform: 'none' } },
        'fade': { from: { opacity: 0 }, to: { opacity: 1 } },
        'drawer-in': { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
        'drawer-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'none' } },
        'zoom': { from: { opacity: 0, transform: 'scale(.96)' }, to: { opacity: 1, transform: 'none' } },
        'wobble': { '0%,100%': { transform: 'rotate(0)' }, '30%': { transform: 'rotate(-8deg)' }, '60%': { transform: 'rotate(6deg)' } },
      },
      animation: {
        rise: 'rise .32s cubic-bezier(.16,1,.3,1) both',
        fade: 'fade .18s ease-out both',
        'drawer-in': 'drawer-in .28s cubic-bezier(.16,1,.3,1) both',
        'drawer-left': 'drawer-left .28s cubic-bezier(.16,1,.3,1) both',
        zoom: 'zoom .22s cubic-bezier(.16,1,.3,1) both',
        wobble: 'wobble .5s ease-in-out',
      },
    },
  },
  plugins: [],
};
