import {
  getAppliedWorkspaceTheme,
  subscribeWorkspaceTheme,
} from "../../settings/model/appearance";

export type GruvboxIcons = {
  files: Record<string, string>;
  exts: Record<string, string>;
  folders: Record<string, string>;
  svgs: Record<string, string>;
};

const DEFAULT_ICONS = new Set(["file", "folder", "folder-open", "folder-root"]);

let table: GruvboxIcons | null = null;
let loading = false;
const listeners = new Set<() => void>();

function load() {
  if (table || loading) return;
  loading = true;
  void import("../model/gruvboxIcons.json").then((mod) => {
    table = mod.default as GruvboxIcons;
    for (const listener of listeners) listener();
  });
}

export function subscribeGruvboxIcons(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  const unsubscribe = subscribeWorkspaceTheme(onStoreChange);
  if (getAppliedWorkspaceTheme() === "gruvbox") load();
  return () => {
    listeners.delete(onStoreChange);
    unsubscribe();
  };
}

export function getGruvboxIcons(): GruvboxIcons | null {
  if (getAppliedWorkspaceTheme() !== "gruvbox") return null;
  load();
  return table;
}

/** Empty string means "not covered": the caller falls back to the Material icon. */
export function gruvboxSvg(
  icons: GruvboxIcons,
  name: string,
  isDir: boolean,
  materialIcon: string,
): string {
  const key = name.toLowerCase();
  let icon = isDir ? icons.folders[key] : icons.files[key];
  if (!isDir) {
    const parts = key.split(".");
    for (let i = parts[0] === "" ? 2 : 1; !icon && i < parts.length; i++) {
      icon = icons.exts[parts.slice(i).join(".")];
    }
  }
  if (!icon && DEFAULT_ICONS.has(materialIcon)) {
    icon = isDir ? "folder" : "file";
  }
  return (icon && icons.svgs[icon]) || "";
}
