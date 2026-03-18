"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MemberListItem, UserRole } from "@/lib/types";
import { formatDateTime } from "@/lib/utils/format";
import styles from "./member-list.module.css";

interface MemberListProps {
  members: MemberListItem[];
  currentUserId: string;
  isAdmin: boolean;
}

type MemberAction = "approve" | "unapprove" | "role";

export function MemberList({
  members,
  currentUserId,
  isAdmin,
}: MemberListProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function runAction(
    memberId: string,
    action: MemberAction,
    nextRole?: UserRole,
  ) {
    startTransition(async () => {
      setMessage("");
      setPendingId(memberId);

      const response = await fetch(`/api/admin/members/${memberId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          role: nextRole,
        }),
      });

      const payload = (await response.json()) as { message: string };
      setMessage(payload.message);
      setPendingId(null);

      if (response.ok) {
        router.refresh();
      }
    });
  }

  function removeMember(memberId: string) {
    startTransition(async () => {
      setMessage("");
      setPendingId(memberId);

      const response = await fetch(`/api/admin/members/${memberId}`, {
        method: "DELETE",
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

  function purgeMember(memberId: string) {
    const confirmed = window.confirm(
      "削除済みメンバーの履歴を完全に削除します。元に戻せません。続行しますか？",
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      setMessage("");
      setPendingId(memberId);

      const response = await fetch(`/api/admin/members/${memberId}?purge=1`, {
        method: "DELETE",
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

  if (members.length === 0) {
    return <div className={styles.empty}>表示できるメンバーはいません。</div>;
  }

  return (
    <div className={styles.list}>
      {members.map((member) => {
        const isSelf = member.id === currentUserId;
        const pending = isPending && pendingId === member.id;
        const isDeleted = Boolean(member.deleted_at);

        return (
          <article className={styles.item} key={member.id}>
            <div className={styles.header}>
              <div>
                <div className={styles.name}>{member.full_name || "未設定"}</div>
                <div className={styles.email}>{member.email}</div>
              </div>
              <div className={styles.badges}>
                {isAdmin ? <span className={styles.badge}>{member.role}</span> : null}
                {isAdmin ? (
                  <span
                    className={`${styles.badge} ${
                      member.is_approved ? styles.approved : styles.pending
                    }`}
                  >
                    {member.is_approved ? "承認済み" : "未承認"}
                  </span>
                ) : null}
                {isAdmin ? (
                  <span
                    className={`${styles.badge} ${
                      isDeleted ? styles.deleted : styles.active
                    }`}
                  >
                    {isDeleted ? "削除済み" : "有効"}
                  </span>
                ) : null}
              </div>
            </div>

            {isAdmin ? (
              <dl className={styles.meta}>
                <div>
                  <dt>承認日</dt>
                  <dd>{formatDateTime(member.approved_at)}</dd>
                </div>
                <div>
                  <dt>作成日</dt>
                  <dd>{formatDateTime(member.created_at)}</dd>
                </div>
                <div>
                  <dt>最終ログイン</dt>
                  <dd>{formatDateTime(member.last_login_at)}</dd>
                </div>
                <div>
                  <dt>論理削除状態</dt>
                  <dd>{isDeleted ? "削除済み" : "有効"}</dd>
                </div>
              </dl>
            ) : null}

            {isAdmin && !isDeleted ? (
              <div className={styles.actions}>
                <button
                  className={styles.button}
                  type="button"
                  onClick={() =>
                    runAction(
                      member.id,
                      member.is_approved ? "unapprove" : "approve",
                    )
                  }
                  disabled={pending}
                >
                  {member.is_approved ? "承認解除" : "承認"}
                </button>
                <button
                  className={styles.button}
                  type="button"
                  onClick={() =>
                    runAction(
                      member.id,
                      "role",
                      member.role === "admin" ? "user" : "admin",
                    )
                  }
                  disabled={pending || isSelf}
                >
                  {member.role === "admin" ? "user に変更" : "admin に変更"}
                </button>
                <button
                  className={styles.dangerButton}
                  type="button"
                  onClick={() => removeMember(member.id)}
                  disabled={pending || isSelf}
                >
                  削除
                </button>
              </div>
            ) : null}

            {isAdmin && isDeleted ? (
              <div className={styles.actions}>
                <button
                  className={styles.dangerButton}
                  type="button"
                  onClick={() => purgeMember(member.id)}
                  disabled={pending}
                >
                  履歴削除
                </button>
              </div>
            ) : null}
          </article>
        );
      })}

      {message ? <p className={styles.message}>{message}</p> : null}
    </div>
  );
}
