import type { Mock } from "vitest";

type Message = { id?: number; method?: string; params?: any };
type Handler = (message: string | null) => void;

let nextRoot = 0;

/** Answers the Rust LSP commands like a running `tsgo`, for tests. */
export function fakeTsgo(
  invoke: Mock,
  respond: (method: string, params: any) => unknown = () => null,
  capabilities: Record<string, unknown> = {},
) {
  const root = `/repo${nextRoot++}`;
  const sent: Message[] = [];
  let channel: { onmessage: Handler } | null = null;
  invoke.mockImplementation(async (command: string, args: any) => {
    if (command === "lsp_document") {
      return {
        root,
        rootUri: `file://${root}`,
        uri: `file://${args.path}`,
        languageId: "typescript",
      };
    }
    if (command === "lsp_connect") {
      channel = args.channel;
      return;
    }
    if (command !== "lsp_send") return;
    for (const raw of args.messages as string[]) {
      const message = JSON.parse(raw) as Message;
      sent.push(message);
      if (message.id == null || !message.method) continue;
      const result =
        message.method === "initialize"
          ? { capabilities: { textDocumentSync: 2, ...capabilities } }
          : respond(message.method, message.params);
      queueMicrotask(() =>
        channel?.onmessage(
          JSON.stringify({ jsonrpc: "2.0", id: message.id, result }),
        ),
      );
    }
  });
  return {
    root,
    sent,
    methods: () => sent.map((message) => message.method),
    exit: () => channel?.onmessage(null),
  };
}

export class FakeChannel {
  onmessage: Handler;
  constructor(onmessage: Handler = () => {}) {
    this.onmessage = onmessage;
  }
}
