export function ImageTokenRuns({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[Image #\d+\])/).map((part, index) =>
        index % 2 ? (
          <span key={index} className="text-mention">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
