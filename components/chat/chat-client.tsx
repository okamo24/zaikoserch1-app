"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import type {
  ImportSummary,
  SearchInventoryItem,
  SearchResponse,
} from "@/lib/types";
import { formatDateTime } from "@/lib/utils/format";
import { InventoryCard } from "@/components/chat/inventory-card";
import styles from "./chat-client.module.css";

type ChatMessage =
  | {
      id: string;
      role: "assistant" | "user";
      text: string;
      items?: never;
    }
  | {
      id: string;
      role: "assistant";
      text: string;
      items: SearchInventoryItem[];
    };

interface ChatClientProps {
  importSummary: ImportSummary | null;
}

function buildInitialMessages(summary: ImportSummary | null): ChatMessage[] {
  const messages: ChatMessage[] = [
    {
      id: "initial-message",
      role: "assistant",
      text: "こんにちは。商品名やバーコードを入力して在庫を検索してください。",
    },
  ];

  if (!summary) {
    messages.push({
      id: "initial-no-data-message",
      role: "assistant",
      text: "在庫データが未取込です。管理者に CSV インポートを依頼してください。",
    });
  }

  return messages;
}

function responseToMessage(response: SearchResponse): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    text: response.message,
    items: response.items.length > 0 ? response.items : undefined,
  };
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

function CameraIcon() {
  return (
    <svg
      aria-hidden="true"
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.7l1.3-2h5l1.3 2h1.7A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg
      aria-hidden="true"
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="3.5" width="6" height="10" rx="3" />
      <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0" />
      <path d="M12 17v3.5" />
      <path d="M9 20.5h6" />
    </svg>
  );
}

export function ChatClient({ importSummary }: ChatClientProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    buildInitialMessages(importSummary),
  );
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [scannerMessage, setScannerMessage] = useState("");
  const supportSpeech = useSyncExternalStore(
    () => () => undefined,
    () => Boolean(getSpeechRecognition()),
    () => false,
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const runSearch = useCallback(
    async (rawQuery?: string) => {
      const nextQuery = (rawQuery ?? query).trim();

      if (!nextQuery) {
        return;
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "user",
          text: nextQuery,
        },
      ]);

      setQuery("");

      startTransition(async () => {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(nextQuery)}`,
          {
            method: "GET",
            credentials: "same-origin",
          },
        );

        if (!response.ok) {
          setMessages((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              text: "検索に失敗しました。時間をおいて再度お試しください。",
            },
          ]);
          return;
        }

        const payload = (await response.json()) as SearchResponse;
        setMessages((current) => [...current, responseToMessage(payload)]);
      });
    },
    [query],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isScannerOpen]);

  useEffect(() => {
    if (!isScannerOpen || !videoRef.current) {
      return;
    }

    const codeReader = new BrowserMultiFormatReader();
    let isActive = true;

    void codeReader
      .decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, error, controls) => {
          scannerControlsRef.current = controls;

          if (result && isActive) {
            const text = result.getText();
            controls.stop();
            setIsScannerOpen(false);
            setScannerMessage("");
            setQuery(text);
            void runSearch(text);
            return;
          }

          if (error && error.name !== "NotFoundException" && isActive) {
            setScannerMessage(
              "バーコードを読み取れませんでした。再度お試しください。",
            );
          }
        },
      )
      .catch(() => {
        if (isActive) {
          setScannerMessage(
            "カメラを起動できませんでした。ブラウザ設定を確認してください。",
          );
        }
      });

    return () => {
      isActive = false;
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;
    };
  }, [isScannerOpen, runSearch]);

  function startVoiceInput() {
    const SpeechRecognitionCtor = getSpeechRecognition();

    if (!SpeechRecognitionCtor) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "この端末では音声入力を利用できません。文字入力またはカメラをご利用ください。",
        },
      ]);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "ja-JP";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      setIsListening(false);

      if (!transcript) {
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: "音声を認識できませんでした。もう一度お試しください。",
          },
        ]);
        return;
      }

      setQuery(transcript);
      void runSearch(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "音声を認識できませんでした。もう一度お試しください。",
        },
      ]);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    setIsListening(true);
    recognition.start();
  }

  return (
    <div className={styles.layout}>
      <section className={styles.summary}>
        <div className={styles.summaryStats}>
          <div className={styles.summaryStat}>
            <span className={styles.summaryLabel}>総在庫数</span>
            <strong>{(importSummary?.stock_total ?? 0).toLocaleString("ja-JP")}</strong>
          </div>
          <div className={styles.summaryStat}>
            <span className={styles.summaryLabel}>納品目数</span>
            <strong>{(importSummary?.item_count ?? 0).toLocaleString("ja-JP")}</strong>
          </div>
          <div className={styles.summaryStat}>
            <span className={styles.summaryLabel}>最終取込日時</span>
            <strong className={styles.summaryDate}>
              {formatDateTime(importSummary?.imported_at)}
            </strong>
          </div>
        </div>
      </section>

      <section className={styles.chat}>
        {messages.map((message) => (
          <div
            className={`${styles.messageRow} ${
              message.role === "user" ? styles.user : styles.assistant
            }`}
            key={message.id}
          >
            <div>
              <div className={styles.bubble}>{message.text}</div>
              {message.items?.length ? (
                <div className={styles.cards}>
                  {message.items.map((item) => (
                    <InventoryCard item={item} key={item.id} />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </section>

      <section className={styles.composer}>
        <div className={styles.inputRow}>
          <input
            className={styles.input}
            type="text"
            placeholder="検索"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void runSearch();
              }
            }}
          />
          <button
            className={styles.iconButton}
            type="button"
            onClick={() => {
              setScannerMessage("");
              setIsScannerOpen(true);
            }}
            aria-label="カメラ入力"
            title="カメラ入力"
          >
            <CameraIcon />
          </button>
          <button
            className={styles.iconButton}
            type="button"
            onClick={startVoiceInput}
            disabled={!supportSpeech || isListening}
            aria-label="音声入力"
            title={isListening ? "録音中" : "音声入力"}
          >
            <MicIcon />
          </button>
          <button
            className={styles.submitButton}
            type="button"
            onClick={() => void runSearch()}
            disabled={isPending}
          >
            検索
          </button>
        </div>
      </section>

      {isScannerOpen ? (
        <div className={styles.scannerOverlay}>
          <div className={styles.scannerCard}>
            <video className={styles.scannerVideo} ref={videoRef} />
            <p>{scannerMessage || "ITF または JAN をカメラで読み取ってください。"}</p>
            <div className={styles.scannerActions}>
              <button
                className={styles.closeButton}
                type="button"
                onClick={() => {
                  scannerControlsRef.current?.stop();
                  setIsScannerOpen(false);
                }}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
