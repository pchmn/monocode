import type { HarnessEvent } from "../../core/types";
import { stringField } from "./claudeProtocol";

type SteerTracking = {
  steered: Set<string>;
  waiting: Set<string>;
};

// Keyed by the live process: Claude's queue dies with it.
const trackingByLive = new WeakMap<object, SteerTracking>();

function tracking(live: object): SteerTracking {
  let entry = trackingByLive.get(live);
  if (!entry) {
    entry = { steered: new Set(), waiting: new Set() };
    trackingByLive.set(live, entry);
  }
  return entry;
}

/** Tags a steered message so Claude's `command_lifecycle` lines can name it. */
export function tagSteerMessage(
  live: object,
  message: Record<string, unknown>,
  id: string | undefined,
): Record<string, unknown> {
  if (!id) return message;
  tracking(live).steered.add(id);
  return { ...message, uuid: id };
}

/** True while Claude holds a steered message it has not read yet. */
export function hasWaitingSteers(live: object): boolean {
  return (trackingByLive.get(live)?.waiting.size ?? 0) > 0;
}

/**
 * Claude queues a message sent mid-turn until its current tool call returns.
 * Maps that lifecycle to events, or null when the line is not about a steer.
 */
export function steerLifecycleEvent(
  live: object,
  rec: Record<string, unknown>,
): HarnessEvent | null {
  if (stringField(rec, "type") !== "command_lifecycle") return null;
  const id = stringField(rec, "command_uuid");
  const entry = trackingByLive.get(live);
  if (!id || !entry?.steered.has(id)) return null;
  const state = stringField(rec, "state");
  if (state === "queued") {
    entry.waiting.add(id);
    return { type: "steer.queued", id };
  }
  entry.waiting.delete(id);
  entry.steered.delete(id);
  return state === "started" ? { type: "steer.delivered", id } : null;
}
