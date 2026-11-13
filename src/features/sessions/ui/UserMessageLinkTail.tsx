import type { UserMessageLinks } from "../model/issueReferences";
import { UserLinkPreview } from "./UserLinkPreview";

export function UserMessageLinkTail({
  messageLink,
  cwd,
}: {
  messageLink: UserMessageLinks;
  cwd?: string;
}) {
  const { afterText, afterLinks } = messageLink;
  const nodes = [];
  let last = 0;
  for (const { link, index, length } of afterLinks) {
    nodes.push(afterText.slice(last, index));
    nodes.push(<UserLinkPreview key={index} link={link} cwd={cwd} compact />);
    last = index + length;
  }
  nodes.push(afterText.slice(last));
  return <>{nodes}</>;
}
