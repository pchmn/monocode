export type ApprovalSheetKeyResult =
  | { type: "move"; index: number }
  | { type: "choose"; index: number };

export function approvalSheetKeyAction(
  key: string,
  index: number,
  count: number,
): ApprovalSheetKeyResult | null {
  if (key === "ArrowDown") return { type: "move", index: (index + 1) % count };
  if (key === "ArrowUp")
    return { type: "move", index: (index - 1 + count) % count };
  if (key === "Enter") return { type: "choose", index };
  if (/^[1-9]$/.test(key) && Number(key) <= count)
    return { type: "choose", index: Number(key) - 1 };
  return null;
}
