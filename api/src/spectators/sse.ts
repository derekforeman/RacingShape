export interface SseClient {
  write(event: string, data: unknown): void;
  close(): void;
}

/** Fan-out hub for Server-Sent Events. Transport-agnostic for testability. */
export class SseHub {
  private clients = new Set<SseClient>();

  /** Register a client; returns a remove() to call on disconnect. */
  add(client: SseClient): () => void {
    this.clients.add(client);
    return () => {
      this.clients.delete(client);
    };
  }

  broadcast(event: string, data: unknown): void {
    for (const c of this.clients) c.write(event, data);
  }

  size(): number {
    return this.clients.size;
  }
}
