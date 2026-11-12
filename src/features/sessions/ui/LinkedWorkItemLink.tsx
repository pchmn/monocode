import { openUrl } from "@tauri-apps/plugin-opener";
import type { LinkedWorkItem } from "../model/session";

export function LinkedWorkItemLink({ item }: { item: LinkedWorkItem }) {
  return (
    <a
      href={item.url}
      className="hover:text-content hover:underline"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void openUrl(item.url).catch(() => undefined);
      }}
    >
      {item.repo} #{item.number}
    </a>
  );
}
