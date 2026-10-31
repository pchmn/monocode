export function ImageTokenRuns({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[Image #\d+\])/).map((part, index) =>
        index % 2 ? (
          <span key={index} className="rounded-sm bg-accent/15 text-accent">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
