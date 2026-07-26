"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  practices as seedPractices,
  type Practice,
} from "../data/example-practices";

type Tab = "today" | "history" | "progress" | "sentences";

const cefrLevels = [
  {
    level: "A1",
    group: "基础",
    description: "能使用非常基础的日常表达，进行简单自我介绍；对方说得慢而清楚时可以简单互动。",
  },
  {
    level: "A2",
    group: "基础",
    description: "能处理熟悉、常规的日常交流，用简单语言描述个人背景、环境和眼前需要。",
  },
  {
    level: "B1",
    group: "独立",
    description: "能谈论工作、旅行和兴趣等熟悉话题，描述经历，并简要解释观点和计划。",
  },
  {
    level: "B2",
    group: "独立",
    description: "能讨论具体或抽象的复杂话题，较流畅地互动，并清楚说明观点及其利弊。",
  },
  {
    level: "C1",
    group: "熟练",
    description: "能流畅、自发且灵活地用于社交、学术和职业交流，清晰组织复杂内容。",
  },
  {
    level: "C2",
    group: "熟练",
    description: "能非常流畅、准确且自然地表达，并能在复杂情境中区分细微含义。",
  },
];

function Icon({ name }: { name: string }) {
  const icons: Record<string, string> = {
    today: "⌂",
    history: "◷",
    progress: "↗",
    sentences: "Aa",
    copy: "⧉",
    star: "◇",
    starred: "◆",
    check: "✓",
    delete: "×",
    arrow: "›",
  };
  return <span aria-hidden="true">{icons[name]}</span>;
}

function sanitizeForClipboard(text: string) {
  return text.replace(/\0/g, "").replace(/[\u202A-\u202E\u2066-\u2069]/g, "");
}

async function copyText(text: string) {
  const safeText = sanitizeForClipboard(text);
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(safeText);
      return;
    } catch {
      // Fall through to the user-gesture based compatibility path.
    }
  }
  const activeElement = document.activeElement as HTMLElement | null;
  const area = document.createElement("textarea");
  area.value = safeText;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const copied = document.execCommand("copy");
  area.remove();
  activeElement?.focus();
  if (!copied) throw new Error("Clipboard access was denied");
}

function getScoreTotal(scores: Practice["scores"]) {
  const scored = scores.filter(([, score]) => score !== null);
  return {
    value: scored.reduce((sum, [, score]) => sum + (score ?? 0), 0),
    maximum: scored.length * 10,
  };
}

function practiceTimestamp(practice: Practice) {
  return (
    practice.receivedAt ||
    `${practice.date}T${practice.time}:00+08:00`
  );
}

function comparePracticesNewestFirst(a: Practice, b: Practice) {
  return practiceTimestamp(b).localeCompare(practiceTimestamp(a));
}

function RadarChart({
  scores,
}: {
  scores: Practice["scores"];
}) {
  const center = 150;
  const radius = 102;
  const angleFor = (index: number) => -Math.PI / 2 + index * ((Math.PI * 2) / 5);
  const pointFor = (index: number, ratio: number) => {
    const angle = angleFor(index);
    return [
      center + Math.cos(angle) * radius * ratio,
      center + Math.sin(angle) * radius * ratio,
    ];
  };
  const pointsAt = (ratio: number) =>
    scores
      .map((_, index) => pointFor(index, ratio).join(","))
      .join(" ");
  const scorePoints = scores
    .map(([, score], index) => pointFor(index, (score ?? 0) / 10).join(","))
    .join(" ");

  return (
    <div className="radar-wrap">
      <svg
        className="radar-chart"
        viewBox="0 0 300 310"
        role="img"
        aria-label={scores
          .map(([name, score]) => `${name}: ${score ?? "not scored"}`)
          .join(", ")}
      >
        {[0.2, 0.4, 0.6, 0.8, 1].map((ratio) => (
          <polygon
            className="radar-grid"
            points={pointsAt(ratio)}
            key={ratio}
          />
        ))}
        {scores.map((_, index) => {
          const [x, y] = pointFor(index, 1);
          return (
            <line
              className="radar-axis"
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              key={index}
            />
          );
        })}
        <polygon className="radar-area" points={scorePoints} />
        {scores.map(([, score], index) => {
          const [x, y] = pointFor(index, (score ?? 0) / 10);
          return score === null ? null : (
            <circle className="radar-dot" cx={x} cy={y} r="4.5" key={index} />
          );
        })}
        {scores.map(([name, score], index) => {
          const angle = angleFor(index);
          const labelRadius = 132;
          const x = center + Math.cos(angle) * labelRadius;
          const y = center + Math.sin(angle) * labelRadius;
          const anchor =
            Math.cos(angle) > 0.25
              ? "start"
              : Math.cos(angle) < -0.25
                ? "end"
                : "middle";
          return (
            <text
              className="radar-label"
              x={x}
              y={y}
              textAnchor={anchor}
              dominantBaseline="middle"
              key={name}
            >
              <tspan x={x}>{name}</tspan>
              <tspan className="radar-value" x={x} dy="18">
                {score === null ? "Not scored" : score.toFixed(1)}
              </tspan>
            </text>
          );
        })}
      </svg>
      {scores.some(([, score]) => score === null) && (
        <p className="radar-note">Missing dimensions are marked “Not scored”.</p>
      )}
    </div>
  );
}

function ProgressScatter({ records }: { records: Practice[] }) {
  const [expandedPractice, setExpandedPractice] = useState<string | null>(null);
  const chronological = [...records].sort((a, b) =>
    practiceTimestamp(a).localeCompare(practiceTimestamp(b)),
  );
  const ticks = [0, 2, 4, 6, 8, 10];

  return (
    <figure
      className="scatter-scroll"
      aria-label="Overall speaking scores from zero to ten, with practices arranged chronologically"
    >
      <div className="scatter-chart">
        <div className="scatter-axis-row">
          <div className="scatter-sequence">练习 ↓</div>
          <div className="scatter-scale" aria-hidden="true">
            {ticks.map((tick) => (
              <span key={tick} style={{ left: `${tick * 10}%` }}>
                {tick}
              </span>
            ))}
          </div>
        </div>

        {chronological.map((item, index) => {
          const expanded = expandedPractice === item.id;
          return (
            <div
              className={`scatter-record ${expanded ? "open" : ""}`}
              key={item.id}
            >
              <div className="scatter-row">
                <button
                  className="scatter-topic-button"
                  onClick={() =>
                    setExpandedPractice(expanded ? null : item.id)
                  }
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "Hide" : "Show"} topic for practice ${index + 1}`}
                >
                  <span>
                    <strong>{index + 1}</strong>
                    <small>{item.date.slice(5).replace("-", "/")}</small>
                  </span>
                  <Icon name="arrow" />
                </button>
                <div className="scatter-track">
                  {ticks.map((tick) => (
                    <i
                      className="scatter-gridline"
                      key={tick}
                      style={{ left: `${tick * 10}%` }}
                    />
                  ))}
                  {item.overall === null ? (
                    <span className="scatter-unscored">Not scored</span>
                  ) : (
                    <span
                      className="scatter-dot"
                      style={{ left: `${item.overall * 10}%` }}
                      title={`${item.topic}: ${item.overall.toFixed(1)}/10`}
                    >
                      <b>{item.overall.toFixed(1)}</b>
                    </span>
                  )}
                </div>
              </div>
              {expanded && (
                <div className="scatter-topic-detail">
                  <strong>{item.topic}</strong>
                </div>
              )}
            </div>
          );
        })}

        <p className="scatter-x-label">Score 0–10 →</p>
      </div>
    </figure>
  );
}

export default function Home() {
  const [practiceRecords, setPracticeRecords] =
    useState<Practice[]>(seedPractices);
  const [tab, setTab] = useState<Tab>("today");
  const [practiceId, setPracticeId] = useState(seedPractices[0].id);
  const [expandedError, setExpandedError] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [deletedSentenceIds, setDeletedSentenceIds] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const [sentenceFilter, setSentenceFilter] = useState("all");
  const [syncError, setSyncError] = useState("");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const toastTimer = useRef<number | null>(null);
  const latestIdRef = useRef(seedPractices[0].id);
  const practices = practiceRecords;

  const allSentences = useMemo(
    () =>
      practices.flatMap((practice) =>
        practice.sentences.map((sentence) => ({
          ...sentence,
          topic: practice.topic,
          time: practice.time,
          date: practice.displayDate,
        })),
      ).filter((sentence) => !deletedSentenceIds.includes(sentence.id)),
    [deletedSentenceIds, practices],
  );

  useEffect(() => {
    let restoreTimer: number | null = null;
    try {
      const savedDeleted = JSON.parse(
        window.localStorage.getItem("gian-deleted-sentence-ids-v1") || "[]",
      );
      const savedFavorites = JSON.parse(
        window.localStorage.getItem("gian-favorite-sentence-ids-v1") || "[]",
      );
      if (Array.isArray(savedDeleted) && Array.isArray(savedFavorites)) {
        const validDeletedIds = savedDeleted.filter(
          (id): id is string => typeof id === "string",
        );
        const validFavoriteIds = savedFavorites.filter(
          (id): id is string => typeof id === "string",
        );
        restoreTimer = window.setTimeout(() => {
          setDeletedSentenceIds(validDeletedIds);
          setFavorites(validFavoriteIds);
        }, 0);
      }
    } catch {
      // A damaged preference should not prevent the sentence library loading.
    }
    return () => {
      if (restoreTimer !== null) window.clearTimeout(restoreTimer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let retryTimer: number | null = null;
    let retryAttempt = 0;

    async function refreshPractices() {
      try {
        const response = await fetch("/api/practices", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          throw new Error(`Update check failed (${response.status})`);
        }
        const result = (await response.json()) as { practices?: Practice[] };
        if (!active || !Array.isArray(result.practices)) {
          throw new Error("Update response is invalid");
        }

        const merged = new Map<string, Practice>();
        const sourceIds = new Map<string, string>();
        for (const item of [...seedPractices, ...result.practices]) {
          if (
            item &&
            typeof item.id === "string" &&
            typeof item.date === "string" &&
            Array.isArray(item.scores)
          ) {
            const previousId = sourceIds.get(item.sourceTurnId);
            if (previousId && previousId !== item.id) {
              merged.delete(previousId);
            }
            merged.set(item.id, item);
            sourceIds.set(item.sourceTurnId, item.id);
          }
        }
        const next = [...merged.values()].sort(comparePracticesNewestFirst);
        if (!next.length) return;
        const previousLatestId = latestIdRef.current;
        const nextLatestId = next[0].id;
        setPracticeId((current) =>
          current === previousLatestId ? nextLatestId : current,
        );
        latestIdRef.current = nextLatestId;
        setPracticeRecords(next);
        setSyncError("");
        setLastChecked(new Date());
        retryAttempt = 0;
      } catch {
        if (active) {
          setSyncError("更新检查失败，目前显示上次保存的记录");
          setLastChecked(new Date());
          if (retryAttempt < 3 && retryTimer === null) {
            const delay = 1500 * 2 ** retryAttempt;
            retryAttempt += 1;
            retryTimer = window.setTimeout(() => {
              retryTimer = null;
              void refreshPractices();
            }, delay);
          }
        }
      }
    }

    void refreshPractices();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        retryAttempt = 0;
        void refreshPractices();
      }
    };
    const handleOnline = () => {
      retryAttempt = 0;
      void refreshPractices();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);

    return () => {
      active = false;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const practice =
    practices.find((item) => item.id === practiceId) ?? practices[0];

  const visibleSentences = useMemo(() => {
    if (sentenceFilter === "favorites") {
      return allSentences.filter((item) => favorites.includes(item.id));
    }
    return allSentences;
  }, [allSentences, favorites, sentenceFilter]);
  const visibleIds = visibleSentences.map((item) => item.id);
  const selectedVisible = visibleSentences.filter((item) =>
    selected.includes(item.id),
  );
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const latestPractice = practices[0];
  const practiceTotal = getScoreTotal(practice.scores);
  const isLatestPractice = practice.id === latestPractice.id;
  const cefrParts = practice.cefr.split(/\s*→\s*/, 2);
  const historyMonthKey = latestPractice.date.slice(0, 7);
  const [historyYear, historyMonth] = historyMonthKey.split("-").map(Number);
  const historyMonthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(historyYear, historyMonth - 1, 1)));
  const daysInHistoryMonth = new Date(
    Date.UTC(historyYear, historyMonth, 0),
  ).getUTCDate();
  const leadingHistoryBlanks =
    (new Date(Date.UTC(historyYear, historyMonth - 1, 1)).getUTCDay() + 6) % 7;
  const practicedDays = new Set(
    practices
      .filter((item) => item.date.startsWith(`${historyMonthKey}-`))
      .map((item) => Number(item.date.slice(-2))),
  );

  function showToast(message: string) {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(""), 1800);
  }

  async function handleCopy(text: string, message = "Sentence copied") {
    try {
      await copyText(text);
      showToast(message);
    } catch {
      showToast("Copy failed — please try again");
    }
  }

  async function copySelected() {
    const chosen = selectedVisible;
    if (!chosen.length) return;
    const text = chosen
      .map(
        (item, index) =>
          `${index + 1}. ${item.text}\n   ${item.zh}\n   场景：${item.scene}\n   搭配：${item.phrase}`,
      )
      .join("\n\n");
    await handleCopy(text, `Copied ${chosen.length} sentences`);
  }

  function toggleFavorite(sentenceId: string) {
    setFavorites((current) => {
      const next = current.includes(sentenceId)
        ? current.filter((id) => id !== sentenceId)
        : [...current, sentenceId];
      try {
        window.localStorage.setItem(
          "gian-favorite-sentence-ids-v1",
          JSON.stringify(next),
        );
      } catch {
        showToast("Favorite changed for now — this browser could not save it");
      }
      return next;
    });
  }

  function deleteSelectedSentences() {
    const chosenIds = selectedVisible.map((sentence) => sentence.id);
    if (!chosenIds.length) return;
    const confirmed = window.confirm(
      `Delete ${chosenIds.length} selected ${chosenIds.length === 1 ? "sentence" : "sentences"} from the sentence library?\n\nThe original practice report will remain unchanged.`,
    );
    if (!confirmed) return;

    const nextDeletedIds = [...new Set([...deletedSentenceIds, ...chosenIds])];
    setDeletedSentenceIds(nextDeletedIds);
    setFavorites((current) => {
      const next = current.filter((id) => !chosenIds.includes(id));
      try {
        window.localStorage.setItem(
          "gian-favorite-sentence-ids-v1",
          JSON.stringify(next),
        );
      } catch {
        // The deletion message below already explains local persistence.
      }
      return next;
    });
    setSelected([]);
    try {
      window.localStorage.setItem(
        "gian-deleted-sentence-ids-v1",
        JSON.stringify(nextDeletedIds),
      );
      showToast(
        `Deleted ${chosenIds.length} ${chosenIds.length === 1 ? "sentence" : "sentences"}`,
      );
    } catch {
      showToast("Deleted for now — this browser could not save the change");
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">GIAN ORAL PRACTICE</p>
          <h1>
            {tab === "today" && "Latest report"}
            {tab === "history" && "Practice history"}
            {tab === "progress" && "Your progress"}
            {tab === "sentences" && "Sentence library"}
          </h1>
          <p className="muted">
            {tab === "today" && (
              <>
                {isLatestPractice ? "Latest verified report" : "Verified report"}
                <span className="report-datetime">
                  {practice.displayDate} · {practice.time}
                </span>
              </>
            )}
            {tab === "history" && "All verified speaking practice reports"}
            {tab === "progress" && "All verified practices in time order"}
            {tab === "sentences" &&
              `${allSentences.length} verified expressions worth keeping`}
          </p>
          {lastChecked && (
            <p className={`sync-status ${syncError ? "error" : ""}`}>
              {syncError ||
                `已检查更新 · ${lastChecked.toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`}
            </p>
          )}
        </div>
        <div className="avatar" aria-hidden="true">
          G
        </div>
      </header>

      {tab === "today" && (
        <>
          <section className="hero-card">
            <div>
              <p className="card-label">CEFR-ALIGNED SPEAKING ASSESSMENT</p>
              <div className="score-line">
                <strong>{cefrParts[0]}</strong>
                <span>
                  {cefrParts[1] ? `toward ${cefrParts[1]}` : "CEFR level"}
                </span>
              </div>
            </div>
            <div className="total-score">
              <strong>{practiceTotal.value.toFixed(1)}</strong>
              <span>/ {practiceTotal.maximum}</span>
              <small>five dimensions</small>
            </div>
          </section>

          <section className="section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">
                  {practice.id === practices[0].id
                    ? "LATEST PRACTICE"
                    : "PRACTICE REPORT"}
                </p>
                <h2>{practice.topic}</h2>
                <p className="muted">
                  {practice.displayDate} · {practice.time}
                </p>
              </div>
              <span className="level-pill">{practice.cefr}</span>
            </div>

            <RadarChart scores={practice.scores} />

            <blockquote>{practice.summary}</blockquote>
            <p className="source-note">
              Source: ChatGPT · verified practice report
            </p>
          </section>

          <section className="section">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">ERRORS TO CORRECT</p>
                <h2>Learn from the details</h2>
              </div>
              <span className="count-badge">{practice.errors.length}</span>
            </div>

            <div className="error-list">
              {practice.errors.map((error, index) => {
                const open = expandedError === index;
                return (
                  <article className={`error-card ${open ? "open" : ""}`} key={error.id}>
                    <button
                      className="error-summary"
                      onClick={() => setExpandedError(open ? -1 : index)}
                      aria-expanded={open}
                    >
                      <span>
                        <small>{error.type}</small>
                        <strong>{error.original}</strong>
                      </span>
                      <Icon name="arrow" />
                    </button>
                    {open && (
                      <div className="error-detail">
                        <div className="correction">
                          <span className="wrong">×</span>
                          <p>{error.original}</p>
                          <span className="right">✓</span>
                          <p>{error.corrected}</p>
                        </div>
                        <p className="explanation">{error.reason}</p>
                        <div className="memory-chip">
                          <span>Remember</span>
                          <strong>{error.memory}</strong>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="section">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">SENTENCES TO REMEMBER</p>
                <h2>Keep the good language</h2>
              </div>
              <button className="text-button" onClick={() => setTab("sentences")}>
                View all
              </button>
            </div>
            <div className="sentence-preview">
              {practice.sentences.slice(0, 2).map((sentence) => (
                <article className="sentence-card" key={sentence.id}>
                  <p>{sentence.text}</p>
                  <span>{sentence.zh}</span>
                  <div>
                    <small>{sentence.phrase}</small>
                    <button
                      aria-label={`Copy ${sentence.text}`}
                      onClick={() => handleCopy(sentence.text)}
                    >
                      <Icon name="copy" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="section">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">VERIFIED REPORTS</p>
                <h2>All speaking practices</h2>
              </div>
            </div>
            <div className="practice-list">
              {practices.map((item) => (
                <button
                  key={item.id}
                  className={item.id === practiceId ? "active" : ""}
                  onClick={() => {
                    setPracticeId(item.id);
                    setExpandedError(0);
                    window.scrollTo({ top: 250, behavior: "smooth" });
                  }}
                >
                  <time>{item.time}</time>
                  <span>
                    <strong>{item.topic}</strong>
                    <small>{item.displayDate}</small>
                  </span>
                  <b>
                    {item.overall === null
                      ? "Baseline"
                      : `${item.overall.toFixed(1)}/10`}
                  </b>
                  <Icon name="arrow" />
                </button>
              ))}
            </div>
          </section>

          <section className="section last-section cefr-guide">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">CEFR LEVEL GUIDE</p>
                <h2>从 A1 到 C2</h2>
                <p className="muted">语言能力由基础、独立到熟练</p>
              </div>
            </div>
            <div className="cefr-level-list">
              {cefrLevels.map((item) => (
                <article
                  className={
                    item.level === "B1" || item.level === "B2"
                      ? "current-range"
                      : ""
                  }
                  key={item.level}
                >
                  <div>
                    <strong>{item.level}</strong>
                    <span>{item.group}</span>
                  </div>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
            <p className="cefr-source">
              根据欧洲委员会 CEFR Global Scale 精简整理
            </p>
          </section>
        </>
      )}

      {tab === "history" && (
        <section className="section standalone">
          <div className="month-strip">
            <strong>{historyMonthLabel}</strong>
          </div>
          <div className="calendar-card">
            <div className="week-labels">
              {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
                <span key={`${day}-${i}`}>{day}</span>
              ))}
            </div>
            <div
              className="calendar-days"
              aria-label={`${historyMonthLabel} practice calendar`}
            >
              {Array.from({ length: leadingHistoryBlanks }, (_, index) => (
                <span aria-hidden="true" key={`blank-${index}`} />
              ))}
              {Array.from(
                { length: daysInHistoryMonth },
                (_, index) => index + 1,
              ).map((day) => (
                <span
                  className={
                    latestPractice.date.startsWith(`${historyMonthKey}-`) &&
                    day === Number(latestPractice.date.slice(-2))
                      ? "selected"
                      : practicedDays.has(day)
                        ? "practiced"
                        : ""
                  }
                  key={day}
                  aria-label={`${day} ${historyMonthLabel}${
                    day === Number(latestPractice.date.slice(-2))
                      ? ", latest practice"
                      : ""
                  }`}
                >
                  {day}
                </span>
              ))}
            </div>
          </div>
          <div className="history-summary">
            <p className="eyebrow">
              ALL RECORDS · {practices.length} VERIFIED REPORTS
            </p>
            {practices.map((item) => (
              <button key={item.id} onClick={() => { setPracticeId(item.id); setExpandedError(0); setTab("today"); }}>
                <span className="history-level">
                  {item.cefr.split(/\s*→\s*/, 1)[0]}
                </span>
                <span>
                  <strong>{item.topic}</strong>
                  <small>{item.displayDate} · {item.time}</small>
                </span>
                <b>{item.overall === null ? "—" : item.overall.toFixed(1)}</b>
                <Icon name="arrow" />
              </button>
            ))}
          </div>
        </section>
      )}

      {tab === "progress" && (
        <section className="section standalone">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">ALL PRACTICES</p>
              <h2>Speaking score scatter plot</h2>
              <p className="muted">{practices.length} verified records</p>
            </div>
          </div>
          <ProgressScatter records={practices} />
        </section>
      )}

      {tab === "sentences" && (
        <section className="section standalone sentence-library">
          <div className="library-toolbar">
            <div className="segmented">
              <button
                className={sentenceFilter === "all" ? "active" : ""}
                onClick={() => {
                  setSentenceFilter("all");
                  setSelected([]);
                }}
              >
                All
              </button>
              <button
                className={sentenceFilter === "favorites" ? "active" : ""}
                onClick={() => {
                  setSentenceFilter("favorites");
                  setSelected([]);
                }}
              >
                Favorites
              </button>
            </div>
            <button
              className="select-all"
              onClick={() =>
                setSelected(
                  allVisibleSelected
                    ? []
                    : visibleIds,
                )
              }
            >
              {allVisibleSelected ? "Clear" : "Select all"}
            </button>
          </div>

          <div className="library-list">
            {visibleSentences.map((sentence) => {
              const isSelected = selected.includes(sentence.id);
              const favorite = favorites.includes(sentence.id);
              return (
                <article className={`library-card ${isSelected ? "selected" : ""}`} key={sentence.id}>
                  <button
                    className="selection"
                    aria-label={`Select ${sentence.text}`}
                    aria-pressed={isSelected}
                    onClick={() =>
                      setSelected((current) =>
                        isSelected
                          ? current.filter((id) => id !== sentence.id)
                          : [...current, sentence.id],
                      )
                    }
                  >
                    {isSelected && <Icon name="check" />}
                  </button>
                  <div className="library-copy">
                    <p>{sentence.text}</p>
                    <span>{sentence.zh}</span>
                    <div className="tags">
                      <small>{sentence.scene}</small>
                      <small>{sentence.phrase}</small>
                    </div>
                    <p className="source">
                      {sentence.topic} · {sentence.date}, {sentence.time}
                    </p>
                  </div>
                  <div className="library-actions">
                    <button
                      aria-label={favorite ? "Remove favorite" : "Add favorite"}
                      aria-pressed={favorite}
                      onClick={() => toggleFavorite(sentence.id)}
                    >
                      <Icon name={favorite ? "starred" : "star"} />
                    </button>
                    <button
                      aria-label={`Copy ${sentence.text}`}
                      onClick={() =>
                        handleCopy(
                          `${sentence.text}\n${sentence.zh}\n场景：${sentence.scene}\n搭配：${sentence.phrase}`,
                        )
                      }
                    >
                      <Icon name="copy" />
                    </button>
                  </div>
                </article>
              );
            })}
            {visibleSentences.length === 0 && (
              <div className="library-empty">
                <strong>No sentences here</strong>
                <span>
                  {sentenceFilter === "favorites"
                    ? "Add a favorite to see it in this list."
                    : "New sentences will appear after your next report is pushed."}
                </span>
              </div>
            )}
          </div>

          {selectedVisible.length > 0 && (
            <div className="copy-dock">
              <span>{selectedVisible.length} selected</span>
              <div className="copy-dock-actions">
                <button
                  className="delete-selected"
                  onClick={deleteSelectedSentences}
                >
                  <Icon name="delete" /> Delete
                </button>
                <button onClick={copySelected}>
                  <Icon name="copy" /> Copy notes
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <nav className="bottom-nav" aria-label="Main navigation">
        {[
          ["today", "Latest"],
          ["history", "History"],
          ["progress", "Progress"],
          ["sentences", "Sentences"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => {
              setTab(id as Tab);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <Icon name={id} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {toast && <div className="toast" role="status" aria-live="polite"><Icon name="check" /> {toast}</div>}
    </main>
  );
}
