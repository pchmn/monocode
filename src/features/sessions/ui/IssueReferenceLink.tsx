import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState, type ReactNode } from "react";
import type { GithubWorkItem } from "../../inbox/model/githubTasks";
import { resolveIssueReference } from "../model/issueReferences";

/** `#123` as a link to its GitHub issue or PR, or plain text if none exists. */
export function IssueReferenceLink({
  cwd,
  number,
  children,
}: {
  cwd: string;
  number: number;
  children: ReactNode;
}) {
  const [item, setItem] = useState<GithubWorkItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItem(null);
    void resolveIssueReference(cwd, number).then((found) => {
      if (!cancelled) setItem(found);
    });
    return () => {
      cancelled = true;
    };
  }, [cwd, number]);

  if (!item) return <>{children}</>;
  const kind = item.kind === "pr" ? "PR" : "Issue";
  return (
    <a
      href={item.url}
      title={`${kind} #${item.number} · ${item.title}`}
      className="text-sky-400/90 hover:text-sky-300 hover:underline"
      onClick={(event) => {
        event.preventDefault();
        void openUrl(item.url).catch((error) => {
          console.error("Failed to open web link:", error);
        });
      }}
    >
      {children}
    </a>
  );
}
