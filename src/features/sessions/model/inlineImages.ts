import type { Attachment } from "./session";

export function imageToken(imageNumber: number): string {
  return `[Image #${imageNumber}]`;
}

/** Each numbered image goes right after its `[Image #N]` token; the rest follow the text. */
export function interleaveAttachments<T>(
  text: string,
  attachments: Attachment[],
  textBlock: (text: string) => T,
  fileBlock: (file: Attachment) => T,
): T[] {
  const byToken = new Map(
    attachments
      .filter((file) => file.imageNumber)
      .map((file) => [imageToken(file.imageNumber!), file]),
  );
  const placed = new Set<Attachment>();
  const blocks: T[] = [];
  let pending = "";
  const flush = () => {
    // Providers reject empty or whitespace-only text blocks.
    if (pending.trim()) blocks.push(textBlock(pending.trim()));
    pending = "";
  };
  for (const part of text.split(/(\[Image #\d+\])/)) {
    pending += part;
    const file = byToken.get(part);
    if (!file || placed.has(file)) continue;
    flush();
    blocks.push(fileBlock(file));
    placed.add(file);
  }
  flush();
  for (const file of attachments) {
    if (!placed.has(file)) blocks.push(fileBlock(file));
  }
  return blocks;
}
