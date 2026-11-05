import type { HarnessEvent } from "../../../integrations/harness/core/types";
import type { QueuedMessage, Session } from "./session";

export function applySteerDelivery(
  session: Session,
  event: Extract<HarnessEvent, { type: "steer.queued" | "steer.delivered" }>,
): Session {
  const pending = event.type === "steer.queued";
  const index = session.blocks.findIndex(
    (block) => block.id === event.id && block.role === "user",
  );
  if (index < 0 || !!session.blocks[index].steerPending === pending) {
    return session;
  }
  const blocks = session.blocks.slice();
  const { steerPending: _cleared, ...block } = blocks[index];
  blocks[index] = pending ? { ...block, steerPending: true } : block;
  return { ...session, blocks };
}

/**
 * A turn that ends before the provider read a steered message loses it with
 * the provider's queue; hand it back to MonoCode's queue so it is sent next.
 */
export function returnUnreadSteers(session: Session): Session {
  const unread = session.blocks.filter(
    (block) => block.role === "user" && block.steerPending,
  );
  if (unread.length === 0) return session;
  const returned: QueuedMessage[] = unread.map((block) => ({
    id: block.id,
    text: block.text,
    attachments: block.attachments ?? [],
  }));
  return {
    ...session,
    blocks: session.blocks.filter((block) => !unread.includes(block)),
    queuedMessages: [...returned, ...(session.queuedMessages ?? [])],
    queueStatus: session.queueStatus ?? "active",
  };
}
