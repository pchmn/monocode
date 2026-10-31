import type { KeyboardEvent, MutableRefObject } from "react";
import {
  insertRestoredText,
  type CapturedDraft,
} from "../../../shared/lib/draftRestore";
import { imageToken } from "../model/inlineImages";
import type { Attachment } from "../model/session";

export function pastedImageAttacher(
  attachmentsRef: MutableRefObject<Attachment[]>,
  addAttachments: (files: Attachment[]) => void,
) {
  return (pasted: Attachment[], captured: CapturedDraft | null) => {
    let last = Math.max(
      0,
      ...attachmentsRef.current.map((file) => file.imageNumber ?? 0),
    );
    const numbered = pasted.map((file) =>
      file.kind === "image" && captured
        ? { ...file, imageNumber: ++last }
        : file,
    );
    const tokens = numbered.flatMap((file) =>
      file.imageNumber ? [imageToken(file.imageNumber)] : [],
    );
    if (captured && tokens.length) {
      const glued = /\S/.test(captured.value[captured.start - 1] ?? "");
      insertRestoredText(captured, `${glued ? " " : ""}${tokens.join(" ")} `);
    }
    addAttachments(numbered);
  };
}

export function removeImageToken(
  field: HTMLTextAreaElement | null,
  removed: Attachment | undefined,
) {
  const token = removed?.imageNumber ? imageToken(removed.imageNumber) : "";
  const at = token && field ? field.value.indexOf(token) : -1;
  if (!field || at < 0) return;
  const end = at + token.length;
  field.setRangeText("", at, field.value[end] === " " ? end + 1 : end);
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

const TOKEN = /\[Image #(\d+)\]/g;

function tokenSpans(value: string) {
  return [...value.matchAll(TOKEN)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
    imageNumber: Number(m[1]),
  }));
}

type TokenEdit = { value: string; start: number; end: number };

export function atomicTokenEdit(
  value: string,
  start: number,
  end: number,
  key: string,
): TokenEdit | null {
  const spans = tokenSpans(value);
  const back = key === "Backspace" || key === "ArrowLeft";
  if (key.startsWith("Arrow")) {
    if (start !== end) return null;
    const hit = spans.find((s) =>
      back ? s.start < start && start <= s.end : s.start <= start && start < s.end,
    );
    const caret = back ? hit?.start : hit?.end;
    return caret === undefined ? null : { value, start: caret, end: caret };
  }
  if (key !== "Backspace" && key !== "Delete") return null;
  let from = start;
  let to = end;
  if (start === end) {
    const hit = spans.find((s) =>
      back ? s.start < start && start <= s.end : s.start <= start && start < s.end,
    );
    if (!hit) return null;
    from = hit.start;
    to = hit.end;
  } else {
    const first = spans.find((s) => s.start < start && start < s.end);
    const last = spans.find((s) => s.start < end && end < s.end);
    if (!first && !last) return null;
    from = first?.start ?? start;
    to = last?.end ?? end;
  }
  if (value[to] === " ") to += 1;
  return { value: value.slice(0, from) + value.slice(to), start: from, end: from };
}

export function imageAtCaret(
  value: string,
  caret: number,
  attachments: Attachment[],
) {
  const hit = tokenSpans(value).find((s) => s.start < caret && caret < s.end);
  return hit && attachments.find((file) => file.imageNumber === hit.imageNumber);
}

/** Opens the clicked token's image and parks the caret after the token, not inside it. */
export function openImageAtCaret(
  field: HTMLTextAreaElement,
  attachments: Attachment[],
  open: (file: Attachment) => void,
) {
  const { value, selectionStart, selectionEnd } = field;
  if (selectionStart !== selectionEnd) return;
  const image = imageAtCaret(value, selectionStart, attachments);
  if (!image) return;
  const end = value.indexOf("]", selectionStart) + 1;
  field.setSelectionRange(end, end);
  open(image);
}

export function applyAtomicTokenKey(e: KeyboardEvent<HTMLTextAreaElement>) {
  const field = e.currentTarget;
  const arrow = e.key.startsWith("Arrow");
  if (e.metaKey || e.altKey || e.ctrlKey || (arrow && e.shiftKey)) return false;
  const edit = atomicTokenEdit(
    field.value,
    field.selectionStart,
    field.selectionEnd,
    e.key,
  );
  if (!edit) return false;
  e.preventDefault();
  if (edit.value !== field.value) {
    field.value = edit.value;
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }
  field.setSelectionRange(edit.start, edit.end);
  return true;
}

export function orphanedImages(value: string, files: Attachment[]) {
  return files.filter(
    (file) => file.imageNumber && !value.includes(imageToken(file.imageNumber)),
  );
}
