// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

import { installMiddleClickLinkGuard } from "./middleClickLinks";

function mount(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  return container;
}

function middleClick(target: Element, type = "auxclick") {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 1 });
  target.dispatchEvent(event);
  return event;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("installMiddleClickLinkGuard", () => {
  it("opens a middle-clicked web link outside the app", () => {
    const root = mount('<a href="https://github.com/o/r/pull/1"><span>#1</span></a>');
    const open = vi.fn(async () => {});
    const uninstall = installMiddleClickLinkGuard(window, open);
    try {
      const event = middleClick(root.querySelector("span")!);
      expect(event.defaultPrevented).toBe(true);
      expect(open).toHaveBeenCalledWith("https://github.com/o/r/pull/1");
    } finally {
      uninstall();
    }
  });

  it("also cancels a middle click delivered as click", () => {
    const root = mount('<a href="https://example.com/">x</a>');
    const open = vi.fn(async () => {});
    const uninstall = installMiddleClickLinkGuard(window, open);
    try {
      expect(middleClick(root.querySelector("a")!, "click").defaultPrevented).toBe(true);
    } finally {
      uninstall();
    }
  });

  it("cancels non-web links without opening them", () => {
    const root = mount('<a href="src/main.tsx">file</a>');
    const open = vi.fn(async () => {});
    const uninstall = installMiddleClickLinkGuard(window, open);
    try {
      expect(middleClick(root.querySelector("a")!).defaultPrevented).toBe(true);
      expect(open).not.toHaveBeenCalled();
    } finally {
      uninstall();
    }
  });

  it("leaves links already handled and non-links alone", () => {
    const root = mount('<a href="https://example.com/">x</a><span>plain</span>');
    const link = root.querySelector("a")!;
    link.addEventListener("auxclick", (event) => event.preventDefault());
    const open = vi.fn(async () => {});
    const uninstall = installMiddleClickLinkGuard(window, open);
    try {
      middleClick(link);
      expect(middleClick(root.querySelector("span")!).defaultPrevented).toBe(false);
      expect(open).not.toHaveBeenCalled();
    } finally {
      uninstall();
    }
  });
});
