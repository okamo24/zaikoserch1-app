"use client";

import { useRouter } from "next/navigation";
import styles from "./back-button.module.css";

interface BackButtonProps {
  fallbackHref: string;
  label?: string;
}

export function BackButton({
  fallbackHref,
  label = "戻る",
}: BackButtonProps) {
  const router = useRouter();

  function handleClick() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <button className={styles.button} type="button" onClick={handleClick}>
      <span className={styles.icon} aria-hidden="true">
        ←
      </span>
      <span>{label}</span>
    </button>
  );
}
