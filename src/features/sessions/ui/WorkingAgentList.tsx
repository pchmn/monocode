import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLockOverscroll } from "../../../shared/hooks/useLockOverscroll";
import { ChevronDown } from "../../../shared/ui/icons";

const FADE = "24px";

function maskFor(above: boolean, below: boolean): string | undefined {
  if (!above && !below) return undefined;
  const top = above ? `transparent, black ${FADE}` : "black, black";
  const bottom = below ? `black calc(100% - ${FADE}), transparent` : "black";
  return `linear-gradient(to bottom, ${top}, ${bottom})`;
}

export function WorkingAgentList({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}) {
  const lockList = useLockOverscroll<HTMLDivElement>();
  const scroller = useRef<HTMLDivElement | null>(null);
  const [above, setAbove] = useState(false);
  const [hidden, setHidden] = useState(0);

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const bottom = el.scrollTop + el.clientHeight;
    setAbove(el.scrollTop > 1);
    setHidden(
      Array.from(
        el.querySelectorAll<HTMLElement>("[data-live-agent-card]"),
      ).filter((card) => card.offsetTop + card.offsetHeight > bottom + 1)
        .length,
    );
  }, []);

  useLayoutEffect(() => {
    measure();
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, count]);

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      scroller.current = el;
      lockList(el);
    },
    [lockList],
  );

  const mask = maskFor(above, hidden > 0);

  return (
    <div className="relative flex min-h-0 flex-col">
      <div
        ref={setRef}
        onScroll={measure}
        style={{ maskImage: mask, WebkitMaskImage: mask }}
        className="relative flex max-h-[18rem] flex-col gap-px overflow-y-auto overscroll-none px-1 pb-1"
      >
        {children}
      </div>
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() =>
            scroller.current?.scrollBy({
              top: scroller.current.clientHeight * 0.8,
              behavior: "smooth",
            })
          }
          className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-stroke bg-background-base px-2 py-0.5 text-[11px] text-content/60 shadow-sm hover:text-content"
        >
          <ChevronDown className="size-3" strokeWidth={1.75} />
          {hidden} more
        </button>
      ) : null}
    </div>
  );
}
