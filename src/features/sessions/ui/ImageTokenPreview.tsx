import { useState } from "react";
import { ImageLightbox } from "../../../shared/ui/ImageLightbox";
import { attachmentPreviewSrc } from "../model/attachments";
import type { Attachment } from "../model/session";

export function useImageTokenPreview() {
  const [file, setFile] = useState<Attachment | null>(null);
  const src = file && attachmentPreviewSrc(file);
  return {
    open: setFile,
    node:
      file && src ? (
        <ImageLightbox src={src} alt={file.name} onClose={() => setFile(null)} />
      ) : null,
  };
}
