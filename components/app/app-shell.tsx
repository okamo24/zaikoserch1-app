"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import styles from "./app-shell.module.css";

interface AppShellProps {
  children: React.ReactNode;
  role: "admin" | "user";
  email: string;
}

const baseLinks = [
  { href: "/chat", label: "在庫" },
  { href: "/members", label: "メンバー" },
  { href: "/settings", label: "設定" },
];

export function AppShell({ children, role, email }: AppShellProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const links =
    role === "admin"
      ? [
          { href: "/chat", label: "在庫" },
          { href: "/members", label: "メンバー" },
          { href: "/admin/import", label: "CSVインポート" },
          { href: "/settings", label: "設定" },
        ]
      : baseLinks;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.mobileBar}>
            <button
              aria-expanded={isMenuOpen}
              aria-label="メニューを開く"
              className={styles.menuButton}
              data-open={isMenuOpen}
              onClick={() => setIsMenuOpen((current) => !current)}
              type="button"
            >
              <span />
              <span />
              <span />
            </button>

            <div className={styles.mobileBrand}>
              <Link href="/chat">在庫検索</Link>
            </div>

            <div aria-hidden="true" className={styles.mobileSpacer} />
          </div>

          <div className={styles.desktopBar}>
            <div className={styles.brand}>
              <Link href="/chat">在庫検索</Link>
              <span>{email}</span>
            </div>

            <nav className={styles.nav}>
            {links.map((link) => (
              <Link
                href={link.href}
                data-active={pathname.startsWith(link.href)}
                key={link.href}
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
              <Link className={styles.logout} href="/login?reset=1">
                ログアウト
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <div
        aria-hidden={!isMenuOpen}
        className={styles.drawerBackdrop}
        data-open={isMenuOpen}
        onClick={() => setIsMenuOpen(false)}
      />

      <aside className={styles.drawer} data-open={isMenuOpen}>
        <div className={styles.drawerHeader}>
          <div className={styles.drawerTitle}>在庫検索</div>
          <div className={styles.drawerEmail}>{email}</div>
        </div>

        <nav className={styles.drawerNav}>
          {links.map((link) => (
            <Link
              href={link.href}
              data-active={pathname.startsWith(link.href)}
              key={link.href}
              onClick={() => setIsMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          className={styles.drawerLogout}
          href="/login?reset=1"
          onClick={() => setIsMenuOpen(false)}
        >
          ログアウト
        </Link>
      </aside>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
