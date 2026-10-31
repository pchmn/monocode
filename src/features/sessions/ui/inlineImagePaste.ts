import type { MutableRefObject } from "react";
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

export function orphanedImages(value: string, files: Attachment[]) {
  return files.filter(
    (file) => file.imageNumber && !value.includes(imageToken(file.imageNumber)),
  );
}
