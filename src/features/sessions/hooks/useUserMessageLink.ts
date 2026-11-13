import { useEffect, useMemo, useState } from "react";
import { parseUserMessageLink, type UserLink } from "../model/linkPreview";
import {
  findIssueReferences,
  resolveIssueReference,
  userMessageLinks,
  type UserMessageLinks,
} from "../model/issueReferences";

/** `parseUserMessageLink`, plus a chip for each `#123` naming an existing issue or PR. */
export function useUserMessageLink(
  text: string,
  cwd: string | undefined,
): UserMessageLinks | null {
  const urlLink = useMemo(
    () => (text ? parseUserMessageLink(text) : null),
    [text],
  );
  const references = useMemo(
    () => (cwd ? findIssueReferences(text) : []),
    [cwd, text],
  );
  const [resolved, setResolved] = useState<ReadonlyMap<number, UserLink>>(
    () => new Map(),
  );

  useEffect(() => {
    setResolved(new Map());
    if (!cwd || references.length === 0) return;
    let cancelled = false;
    const numbers = [...new Set(references.map((ref) => ref.number))];
    void Promise.all(
      numbers.map(async (number) => {
        const item = await resolveIssueReference(cwd, number);
        const link = item ? parseUserMessageLink(item.url)?.link : null;
        return link?.githubWorkItem ? ([number, link] as const) : null;
      }),
    ).then((entries) => {
      if (!cancelled) setResolved(new Map(entries.filter((e) => e !== null)));
    });
    return () => {
      cancelled = true;
    };
  }, [cwd, references]);

  return useMemo(
    () => userMessageLinks(text, urlLink, references, resolved),
    [text, urlLink, references, resolved],
  );
}
