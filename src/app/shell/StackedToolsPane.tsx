/** Hosts the project tools in place of the session list when the side panels are stacked. */
export function StackedToolsPane({
  onHost,
  shown,
}: {
  onHost: (el: HTMLDivElement | null) => void;
  shown: boolean;
}) {
  return (
    <div
      ref={onHost}
      className={shown ? "flex min-h-0 flex-1 flex-col" : "hidden"}
    />
  );
}
