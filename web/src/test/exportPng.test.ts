import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,ZZZ'),
}));

import { toPng } from 'html-to-image';
import { exportNodeToPng } from '../lib/exportPng';

describe('exportNodeToPng', () => {
  let clickSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    clickSpy = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy);
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders the given node to a PNG and triggers a download', async () => {
    const node = document.createElement('div');
    node.id = 'recap-card';
    await exportNodeToPng(node, 'racingshape-2026-06-01.png');

    expect(toPng).toHaveBeenCalledTimes(1);
    expect((toPng as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(node);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the node is null', async () => {
    await exportNodeToPng(null, 'x.png');
    expect(toPng).not.toHaveBeenCalled();
  });
});
