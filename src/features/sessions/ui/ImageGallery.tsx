import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "../../../shared/ui/icons";
import { ImageLightbox } from "../../../shared/ui/ImageLightbox";
import { attachmentPreviewSrc } from "../model/attachments";
import type { Attachment } from "../model/session";

export function galleryImages(
  start: Attachment,
  attachments: readonly Attachment[],
): Attachment[] {
  const images = attachments.filter(
    (file) => file.kind === "image" && attachmentPreviewSrc(file),
  );
  return images.some((file) => file.id === start.id) ? images : [start];
}

export function stepIndex(index: number, step: number, count: number) {
  return (index + step + count) % count;
}

const NAV_BUTTON =
  "absolute top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/45 text-white/80 shadow-lg backdrop-blur-md hover:bg-black/65 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80";

export function ImageGallery({
  start,
  attachments,
  onClose,
}: {
  start: Attachment;
  attachments: readonly Attachment[];
  onClose: () => void;
}) {
  const images = galleryImages(start, attachments);
  const [index, setIndex] = useState(() =>
    Math.max(0, images.findIndex((file) => file.id === start.id)),
  );
  const count = images.length;

  useEffect(() => {
    if (count < 2) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const step =
        event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
      if (!step) return;
      event.preventDefault();
      event.stopPropagation();
      setIndex((current) => stepIndex(current, step, count));
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [count]);

  const file = images[Math.min(index, count - 1)];
  const src = file && attachmentPreviewSrc(file);
  if (!file || !src) return null;

  return (
    // Keyed by image so zoom and pan start fresh on each one.
    <ImageLightbox key={file.id} src={src} alt={file.name} onClose={onClose}>
      {count > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous image"
            title="Previous image (←)"
            onClick={() => setIndex((current) => stepIndex(current, -1, count))}
            className={`${NAV_BUTTON} left-4`}
          >
            <ChevronLeft className="size-5" strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Next image"
            title="Next image (→)"
            onClick={() => setIndex((current) => stepIndex(current, 1, count))}
            className={`${NAV_BUTTON} right-4`}
          >
            <ChevronRight className="size-5" strokeWidth={2} />
          </button>
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-xs tabular-nums text-white/80 backdrop-blur-md">
            {index + 1} / {count}
          </div>
        </>
      ) : null}
    </ImageLightbox>
  );
}
