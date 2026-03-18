// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app/app-shell";
import { ChatClient } from "@/components/chat/chat-client";

const { usePathname } = vi.hoisted(() => ({
  usePathname: vi.fn(() => "/chat"),
}));

vi.mock("@zxing/browser", () => ({
  BrowserMultiFormatReader: class {
    decodeFromVideoDevice() {
      return Promise.resolve();
    }
  },
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname,
}));

describe("mobile UI smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("renders the mobile chat summary and search composer", () => {
    render(
      <ChatClient
        importSummary={{
          imported_at: "2026-03-17T10:05:00.000Z",
          stock_date: "2026-03-17",
          item_count: 4467,
          stock_total: 42446,
        }}
      />,
    );

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByText("42,446")).toBeInTheDocument();
    expect(screen.getByText("4,467")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByText(/2026\/03\/17/)).toBeInTheDocument();
  });

  it("toggles the mobile menu and shows the admin import entry", () => {
    render(
      <AppShell role="admin" email="admin@example.com">
        <div>content</div>
      </AppShell>,
    );

    const menuButton = screen.getByRole("button");
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.getAllByText("admin@example.com")).toHaveLength(2);
    expect(
      screen.getAllByRole("link", { hidden: true }).some((link) => {
        return link.getAttribute("href") === "/admin/import";
      }),
    ).toBe(true);

    fireEvent.click(menuButton);

    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getAllByRole("link", { hidden: true }).some((link) => {
        return link.getAttribute("href") === "/admin/import";
      }),
    ).toBe(true);
  });
});
