import { describe, it, expect } from 'vitest';
import { SseHub, type SseClient } from '../../src/spectators/sse.js';

function fakeClient() {
  const sent: { event: string; data: unknown }[] = [];
  let closed = false;
  const client: SseClient = {
    write: (event, data) => { sent.push({ event, data }); },
    close: () => { closed = true; },
  };
  return { client, sent, isClosed: () => closed };
}

describe('SseHub', () => {
  it('broadcasts to all connected clients', () => {
    const hub = new SseHub();
    const a = fakeClient();
    const b = fakeClient();
    hub.add(a.client);
    hub.add(b.client);
    hub.broadcast('presence', { count: 2 });
    expect(a.sent).toEqual([{ event: 'presence', data: { count: 2 } }]);
    expect(b.sent).toEqual([{ event: 'presence', data: { count: 2 } }]);
  });

  it('stops sending after a client is removed', () => {
    const hub = new SseHub();
    const a = fakeClient();
    const remove = hub.add(a.client);
    remove();
    hub.broadcast('presence', { count: 0 });
    expect(a.sent).toEqual([]);
    expect(hub.size()).toBe(0);
  });

  it('size reflects connected clients', () => {
    const hub = new SseHub();
    expect(hub.size()).toBe(0);
    hub.add(fakeClient().client);
    expect(hub.size()).toBe(1);
  });
});
