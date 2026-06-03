import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        bg2: 'var(--bg2)',
        panel: 'var(--panel)',
        panel2: 'var(--panel2)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        accent: 'var(--accent)',
        accent2: 'var(--accent2)',
        cyan: 'var(--cyan)',
        amber: 'var(--amber)',
        green: 'var(--green)',
        grid: 'var(--grid)',
      },
      fontFamily: {
        head: ['Rajdhani', 'system-ui', 'sans-serif'],
        mono: ['"Chakra Petch"', 'monospace'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
