import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Resolve index.css whether cwd is the web workspace or the repo root (vitest
// workspace runs share the repo-root cwd). import.meta.url is unreliable under jsdom.
const cssPath = ['src/index.css', 'web/src/index.css']
  .map((p) => resolve(process.cwd(), p))
  .find(existsSync) as string;
const css = readFileSync(cssPath, 'utf8');

describe('index.css design tokens', () => {
  it('declares the canonical dark token values (roadmap §9)', () => {
    expect(css).toContain('--bg: #07090d');
    expect(css).toContain('--panel: #11151c');
    expect(css).toContain('--accent: #e10600');
    expect(css).toContain('--cyan: #15d6e0');
    expect(css).toContain('--amber: #ffb300');
    expect(css).toContain('--green: #34d399');
  });

  it('declares the canonical light token overrides', () => {
    expect(css).toContain("[data-theme='light']");
    expect(css).toContain('--bg: #eef1f5');
    expect(css).toContain('--panel: #ffffff');
    expect(css).toContain('--cyan: #0891b2');
  });

  it('includes Tailwind directives and the font-family vars', () => {
    expect(css).toContain('@tailwind base');
    expect(css).toContain('@tailwind components');
    expect(css).toContain('@tailwind utilities');
    expect(css).toContain('Rajdhani');
    expect(css).toContain('Chakra Petch');
    expect(css).toContain('Inter');
  });
});
