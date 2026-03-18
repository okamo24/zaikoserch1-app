"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";
import { formatDateTime } from "@/lib/utils/format";
import styles from "./approval-list.module.css";

interface ApprovalListProps {
  profiles: Profile[];
}

export function ApprovalList({ profiles }: ApprovalListProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function approve(profileId: string) {
    startTransition(async () => {
      setPendingId(profileId);
      setMessage("");

      const response = await fetch(`/api/admin/approvals/${profileId}`, {
        method: "POST",
        credentials: "same-origin",
      });

      const payload = (await response.json()) as { message: string };
      setMessage(payload.message);
      setPendingId(null);

      if (response.ok) {
        router.refresh();
      }
    });
  }

  if (profiles.length === 0) {
    return <div className={styles.empty}>承認待ちユーザーはいません。</div>;
  }

  return (
    <div className={styles.list}>
      {profiles.map((profile) => (
        <div className={styles.item} key={profile.id}>
          <div className={styles.header}>
            <div className={styles.email}>{profile.email}</div>
            <div>{profile.role}</div>
          </div>

          <div className={styles.meta}>
            <div>氏名: {profile.full_name || "未設定"}</div>
            <div>登録日時: {formatDateTime(profile.created_at)}</div>
          </div>

          <div className={styles.actions}>
            <button
              className={styles.button}
              type="button"
              onClick={() => approve(profile.id)}
              disabled={isPending && pendingId === profile.id}
            >
              {isPending && pendingId === profile.id ? "承認中..." : "承認する"}
            </button>
          </div>
        </div>
      ))}

      {message ? <p className={styles.message}>{message}</p> : null}
    </div>
  );
}
