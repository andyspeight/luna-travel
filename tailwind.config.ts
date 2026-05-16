import type { Config } from 'tailwindcss';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tgPreset = require('./packages/ui/tailwind-preset.js');

const config: Config = {
  presets: [tgPreset],
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './packages/ui/**/*.{js,ts,jsx,tsx,mdx}',
  ],
};

export default config;
