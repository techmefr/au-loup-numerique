import { createSession } from '../server/session.js';
import type { Room } from '../server/room.js';

export class LocalSocket {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  private session = createSession((m) => queueMicrotask(() => this.onmessage?.({ data: JSON.stringify(m) })), new Map<string, Room>());

  constructor() {
    setTimeout(() => {
      this.readyState = 1;
      this.onopen?.();
    }, 0);
  }

  send(raw: string): void {
    queueMicrotask(() => this.session.handle(raw));
  }

  close(): void {
    this.session.close();
    this.readyState = 3;
    this.onclose?.();
  }
}
