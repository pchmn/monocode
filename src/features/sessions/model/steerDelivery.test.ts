import { describe, expect, it } from "vitest";
import {
  appendSteerUser,
  applyHarnessEvent,
  stopStreaming,
} from "../../../integrations/harness/core/apply";
import { newSession, type Session } from "./session";
import { returnRefusedSteer } from "./steerDelivery";

function steered(): Session {
  return appendSteerUser(
    { ...newSession("claude", "/repo"), busy: true },
    "also check the footer",
    [],
    { id: "block-1" },
  );
}

describe("steer delivery", () => {
  it("marks a steered message pending until the provider reads it", () => {
    const queued = applyHarnessEvent(steered(), {
      type: "steer.queued",
      id: "block-1",
    });
    expect(queued.blocks.at(-1)).toMatchObject({
      id: "block-1",
      steerPending: true,
    });

    const read = applyHarnessEvent(queued, {
      type: "steer.delivered",
      id: "block-1",
    });
    expect(read.blocks.at(-1)?.steerPending).toBeUndefined();
    expect(stopStreaming(read).blocks.some((b) => b.id === "block-1")).toBe(
      true,
    );
  });

  it("hands an unread steer back to the queue when the turn ends", () => {
    const queued = applyHarnessEvent(
      {
        ...steered(),
        queuedMessages: [{ id: "later", text: "later", attachments: [] }],
        queueStatus: "active",
      },
      { type: "steer.queued", id: "block-1" },
    );

    const stopped = stopStreaming(queued);

    expect(stopped.blocks.some((b) => b.id === "block-1")).toBe(false);
    expect(stopped.queuedMessages?.map((m) => m.id)).toEqual([
      "block-1",
      "later",
    ]);
    expect(stopped.queuedMessages?.[0].text).toBe("also check the footer");
    expect(stopped.queueStatus).toBe("active");
  });

  it("leaves steers without a provider acknowledgement alone", () => {
    const stopped = stopStreaming(steered());
    expect(stopped.blocks.some((b) => b.id === "block-1")).toBe(true);
    expect(stopped.queuedMessages).toBeUndefined();
  });

  it("puts a steer refused after the turn ended back at the head of the queue", () => {
    const refused = returnRefusedSteer(
      {
        ...steered(),
        queuedMessages: [{ id: "later", text: "later", attachments: [] }],
      },
      "block-1",
      { id: "queued-1", text: "also check the footer", attachments: [] },
    );

    expect(refused.blocks.some((b) => b.id === "block-1")).toBe(false);
    expect(refused.queuedMessages?.map((m) => m.id)).toEqual([
      "queued-1",
      "later",
    ]);
    expect(refused.queueStatus).toBe("active");
  });
});
