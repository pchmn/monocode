import { useState } from "react";
import type { Attachment } from "../model/session";
import { ImageGallery } from "./ImageGallery";

export function useImageTokenPreview() {
  const [opened, setOpened] = useState<{
    file: Attachment;
    attachments: readonly Attachment[];
  } | null>(null);
  return {
    open: (file: Attachment, attachments: readonly Attachment[] = [file]) =>
      setOpened({ file, attachments }),
    node: opened ? (
      <ImageGallery
        start={opened.file}
        attachments={opened.attachments}
        onClose={() => setOpened(null)}
      />
    ) : null,
  };
}
