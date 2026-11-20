// Claude delivers a subagent's report through this call's input; the Agent
// tool result then only points at it.
const HANDBACK_TOOL = "SubagentHandback";

type Handback = { report?: string; callIds: Set<string> };

const handbacks = new WeakMap<object, Handback>();

/** Whether the call was the subagent handing its report back. */
export function noteHandback(
  agentCall: object,
  callId: string,
  name: string,
  input: Record<string, unknown>,
): boolean {
  if (name !== HANDBACK_TOOL) return false;
  let handback = handbacks.get(agentCall);
  if (!handback) handbacks.set(agentCall, (handback = { callIds: new Set() }));
  if (callId) handback.callIds.add(callId);
  const message = input.message;
  if (typeof message === "string" && message.trim()) handback.report = message;
  return true;
}

export function isHandbackCall(agentCall: object, callId: string): boolean {
  return handbacks.get(agentCall)?.callIds.has(callId) ?? false;
}

export function handbackReport(
  agentCall: object | undefined,
): string | undefined {
  return agentCall ? handbacks.get(agentCall)?.report : undefined;
}
