import { useEffect, useMemo, useState } from "react";
import {
  parseUserMessageLink,
  type UserMessageLink,
} from "../model/linkPreview";
import {
  findIssueReference,
  resolveIssueReference,
} from "../model/issueReferences";

/** `parseUserMessageLink`, falling back to the first `#123` naming an existing issue or PR. */
export function useUserMessageLink(
  text: string,
  cwd: string | undefined,
): UserMessageLink | null {
  const urlLink = useMemo(
    () => (text ? parseUserMessageLink(text) : null),
    [text],
  );
  const reference = useMemo(
    () => (urlLink || !cwd ? null : findIssueReference(text)),
    [urlLink, cwd, text],
  );
  const [referenceLink, setReferenceLink] = useState<UserMessageLink | null>(
    null,
  );

  useEffect(() => {
    setReferenceLink(null);
    if (!reference || !cwd) return;
    let cancelled = false;
    void resolveIssueReference(cwd, reference.number).then((item) => {
      const link = item ? parseUserMessageLink(item.url)?.link : null;
      if (cancelled || !link?.githubWorkItem) return;
      setReferenceLink({
        link,
        beforeText: text.slice(0, reference.index),
        afterText: text.slice(reference.index + reference.length),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [cwd, reference, text]);

  return urlLink ?? referenceLink;
}
