type Box = Pick<DOMRect, "left" | "top" | "right" | "bottom">;

const within = (x: number, y: number, box: Box) =>
  x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;

/** Over the trigger, the card, or the gap between them where both overlap horizontally. */
export function inHoverBridge(x: number, y: number, trigger: Box, card: Box) {
  if (within(x, y, trigger) || within(x, y, card)) return true;
  return within(x, y, {
    left: Math.max(trigger.left, card.left),
    right: Math.min(trigger.right, card.right),
    top: Math.min(trigger.top, card.top),
    bottom: Math.max(trigger.bottom, card.bottom),
  });
}
