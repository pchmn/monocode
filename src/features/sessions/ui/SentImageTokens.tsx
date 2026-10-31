import { attachmentPreviewSrc } from "../model/attachments";
import type { Attachment } from "../model/session";
import { useImageTokenPreview } from "./ImageTokenPreview";

const TOKEN = /(\[Image #(\d+)\])/;

/** Saved turns drop `imageNumber`, so the Nth image stands in for `[Image #N]`. */
export function sentTokenImage(
  imageNumber: number,
  attachments: readonly Attachment[],
): Attachment | undefined {
  const images = attachments.filter((file) => file.kind === "image");
  return (
    images.find((file) => file.imageNumber === imageNumber) ??
    (images.some((file) => file.imageNumber) ? undefined : images[imageNumber - 1])
  );
}

export function SentImageTokens({
  text,
  attachments,
}: {
  text: string;
  attachments: readonly Attachment[];
}) {
  const preview = useImageTokenPreview();
  const parts = text.split(TOKEN);
  if (parts.length === 1) return <>{text}</>;
  const nodes = [];
  for (let i = 0; i < parts.length; i += 3) {
    nodes.push(parts[i]);
    const token = parts[i + 1];
    if (!token) continue;
    const file = sentTokenImage(Number(parts[i + 2]), attachments);
    nodes.push(
      file && attachmentPreviewSrc(file) ? (
        <button
          key={i}
          type="button"
          title={`Open ${file.name} full screen`}
          onClick={(event) => {
            event.stopPropagation();
            preview.open(file);
          }}
          className="cursor-zoom-in rounded-sm bg-accent/15 text-accent hover:bg-accent/25"
        >
          {token}
        </button>
      ) : (
        <span key={i} className="rounded-sm bg-accent/15 text-accent">
          {token}
        </span>
      ),
    );
  }
  return (
    <>
      {nodes}
      {preview.node}
    </>
  );
}
