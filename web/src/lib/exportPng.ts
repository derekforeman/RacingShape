import { toPng } from 'html-to-image';

/** Render a DOM node to a PNG and trigger a browser download. No-op if node is null. */
export async function exportNodeToPng(node: HTMLElement | null, filename: string): Promise<void> {
  if (!node) return;
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    backgroundColor:
      getComputedStyle(document.documentElement).getPropertyValue('--panel') || '#11151c',
  });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
