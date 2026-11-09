// Past this, the step blocking the message is likely a long command, not a quick tool call.
const LONG_WAIT_MS = 15_000;

export function steerWaitIsLong(waitedMs: number): boolean {
  return waitedMs >= LONG_WAIT_MS;
}

export function formatSteerWait(waitedMs: number): string {
  const totalSec = Math.floor(waitedMs / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}
