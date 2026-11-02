// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Worktree } from "../model/worktrees";

vi.mock("../../../platform/tauri/fs", () => ({
  gitBranches: vi.fn(async () => ({
    current: "feat/x",
    detached: false,
    branches: [
      { name: "feat/x", current: true, remote: null },
      { name: "main", current: false, remote: null },
    ],
  })),
  subscribeGitChanged: () => () => {},
  gitCheckout: vi.fn(),
  gitCommit: vi.fn(),
  gitCreateBranch: vi.fn(),
  gitStageAll: vi.fn(),
  gitStash: vi.fn(),
  isCheckoutBlockedByChanges: () => false,
  notifyGitChanged: vi.fn(),
}));

const mainTree = { path: "/repo", branch: "main", isMain: true } as Worktree;
vi.mock("../hooks/useBranchWorktree", () => ({
  useBranchWorktree: () => (branch: string) =>
    branch === "main" ? mainTree : undefined,
}));

import { BranchPicker } from "./BranchPicker";
import { gitCheckout } from "../../../platform/tauri/fs";

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function pickMain(props: Record<string, unknown>) {
  act(() =>
    root.render(
      createElement(BranchPicker, {
        cwd: "/repo/.worktrees/feat",
        branch: "feat/x",
        ...props,
      }),
    ),
  );
  await act(async () => {});
  await act(async () => container.querySelector("button")!.click());
  const row = [
    ...document.querySelectorAll<HTMLButtonElement>('[role="option"]'),
  ].find((option) => option.textContent?.startsWith("main"))!;
  expect(row.textContent).toContain("worktree");
  await act(async () => row.click());
}

it("opens the worktree holding a branch instead of checking it out", async () => {
  const onSelectWorktree = vi.fn(async () => {});
  await pickMain({ onSelectWorktree });
  expect(onSelectWorktree).toHaveBeenCalledWith(mainTree);
  expect(gitCheckout).not.toHaveBeenCalled();
  expect(document.querySelector("[data-branch-picker]")).toBeNull();
});

it("explains why a held branch cannot be checked out without a worktree switch", async () => {
  await pickMain({});
  expect(gitCheckout).not.toHaveBeenCalled();
  expect(document.querySelector("[data-branch-picker]")?.textContent).toContain(
    "main is checked out in /repo.",
  );
});
