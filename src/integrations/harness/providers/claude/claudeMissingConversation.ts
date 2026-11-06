const MISSING_CONVERSATION = "No conversation found with session ID";

const missingByThread = new Set<string>();

// Claude only writes a transcript once it reads a first message: a session
// stopped while starting up keeps an id that `--resume` can never open.
export function noteMissingConversation(
  threadId: string,
  rec: Record<string, unknown>,
): boolean {
  if (rec.type !== "result" || !Array.isArray(rec.errors)) return false;
  const missing = rec.errors.some(
    (error) =>
      typeof error === "string" && error.startsWith(MISSING_CONVERSATION),
  );
  if (missing) missingByThread.add(threadId);
  return missing;
}

export function takeMissingConversation(threadId: string): boolean {
  return missingByThread.delete(threadId);
}
