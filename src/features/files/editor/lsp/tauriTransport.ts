import type { Transport } from "@codemirror/lsp-client";
import { Channel, invoke } from "@tauri-apps/api/core";

/** Relays messages to the `tsgo` process the Rust side runs for `root`. */
export class TauriTransport implements Transport {
  closed = false;
  // `null` is sent once the process exits.
  readonly channel = new Channel<string | null>((message) => {
    if (message === null) this.close();
    else for (const handler of this.handlers) handler(message);
  });
  private readonly handlers = new Set<(message: string) => void>();
  private queue: string[] = [];
  private flushing = false;

  constructor(private readonly root: string) {}

  send(message: string) {
    if (this.closed) return;
    this.queue.push(message);
    void this.flush();
  }

  subscribe(handler: (message: string) => void) {
    this.handlers.add(handler);
  }

  unsubscribe(handler: (message: string) => void) {
    this.handlers.delete(handler);
  }

  close() {
    this.closed = true;
    this.queue = [];
  }

  // Concurrent invokes may reach Rust out of order; didChange versions must not.
  private async flush() {
    if (this.flushing) return;
    this.flushing = true;
    while (this.queue.length > 0 && !this.closed) {
      const messages = this.queue.splice(0);
      try {
        await invoke("lsp_send", { root: this.root, messages });
      } catch {
        this.close();
      }
    }
    this.flushing = false;
  }
}
