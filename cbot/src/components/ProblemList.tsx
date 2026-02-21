import { useState, useEffect, useCallback, useMemo } from "react";
import { useKeyboard } from "@opentui/react";
import { TextAttributes } from "@opentui/core";
import Fuse from "fuse.js";
import { KeybindHelp } from "./KeybindHelp";
import { InitProblem } from "./InitProblem";
import { DeleteConfirm } from "./DeleteConfirm";
import {
  loadProblems,
  getLanguageFromId,
  theme,
  victoryRainbow,
  type Problem,
} from "../lib";

interface ProblemListProps {
  onSelectProblem: (problem: Problem) => void;
}

type View = "list" | "init" | "search" | "delete";

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(" ");
}

export function ProblemList({ onSelectProblem }: ProblemListProps) {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [view, setView] = useState<View>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [rainbowIndex, setRainbowIndex] = useState(0);

  const filteredProblems = useMemo(() => {
    if (!searchQuery.trim()) return problems;
    const fuse = new Fuse(problems, {
      keys: ["id", "name"],
      threshold: 0.3,
      ignoreLocation: true,
    });
    return fuse.search(searchQuery).map((result) => result.item);
  }, [problems, searchQuery]);

  const totalTimeSpent = useMemo(() => {
    return problems.reduce((sum, p) => sum + (p.timeSpentMs || 0), 0);
  }, [problems]);

  const loadProblemList = useCallback(async () => {
    const list = await loadProblems();
    setProblems(list.sort((a, b) => b.addedAt - a.addedAt));
  }, []);

  useEffect(() => {
    loadProblemList();
  }, [loadProblemList]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRainbowIndex((prev) => (prev + 1) % victoryRainbow.length);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useKeyboard((key) => {
    if (view !== "list" && view !== "search") return;

    if (view === "search") {
      if (key.name === "escape") {
        setView("list");
        setSearchQuery("");
        setSelectedIndex(0);
      } else if (key.name === "return" && filteredProblems.length > 0) {
        const problem = filteredProblems[selectedIndex];
        if (problem) onSelectProblem(problem);
      } else if (key.name === "up") {
        setSelectedIndex((i) => Math.max(0, i - 1));
      } else if (key.name === "down") {
        setSelectedIndex((i) => Math.min(filteredProblems.length - 1, i + 1));
      }
      return;
    }

    if (key.name === "i") {
      setView("init");
    } else if (key.name === "/" || key.name === "s") {
      setView("search");
      setSearchQuery("");
      setSelectedIndex(0);
    } else if (key.name === "d" && filteredProblems.length > 0) {
      setView("delete");
    } else if (key.name === "up" && filteredProblems.length > 0) {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (key.name === "down" && filteredProblems.length > 0) {
      setSelectedIndex((i) => Math.min(filteredProblems.length - 1, i + 1));
    } else if (key.name === "return" && filteredProblems.length > 0) {
      const problem = filteredProblems[selectedIndex];
      if (problem) onSelectProblem(problem);
    }
  });

  if (view === "init") {
    return (
      <InitProblem
        onDone={async () => {
          await loadProblemList();
          setView("list");
        }}
        onCancel={() => setView("list")}
      />
    );
  }

  if (view === "delete") {
    const problem = filteredProblems[selectedIndex];
    if (problem) {
      return (
        <DeleteConfirm
          problem={problem}
          onDone={async () => {
            await loadProblemList();
            setSelectedIndex((i) => Math.max(0, i - 1));
            setView("list");
          }}
          onCancel={() => setView("list")}
        />
      );
    }
    setView("list");
  }

  return (
    <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2}>
      <box flexDirection="row" gap={1} height={1}>
        <text fg={theme.green} attributes={TextAttributes.BOLD}>▓▓</text>
        <text fg={theme.teal} attributes={TextAttributes.BOLD}>▓▓</text>
        <text fg={theme.green} attributes={TextAttributes.BOLD}>CBOT</text>
        <text fg={theme.green}> ━━━━━━━</text>
        <text fg={theme.overlay0}> CODEFORCES PROBLEM MANAGER</text>
        {problems.length > 0 ? (
          <>
            <text fg={theme.green}> ━━━</text>
            <text fg={theme.mauve} attributes={TextAttributes.BOLD}>
              {`⏱ TOTAL: ${formatTime(totalTimeSpent)}`}
            </text>
          </>
        ) : null}
      </box>
      <text fg={theme.green}>{"▀".repeat(78)}</text>

      {view === "search" ? (
        <box flexDirection="row" gap={1} marginTop={1} marginBottom={1}>
          <text fg={theme.green} attributes={TextAttributes.BOLD}>▓▓</text>
          <input
            focused
            value={searchQuery}
            placeholder="search problems..."
            textColor={theme.text}
            backgroundColor={theme.crust}
            width={60}
            onInput={(v) => {
              setSearchQuery(v);
              setSelectedIndex(0);
            }}
          />
        </box>
      ) : null}

      {filteredProblems.length === 0 ? (
        <box flexGrow={1} marginTop={2}>
          <text fg={theme.overlay1}>
            {searchQuery ? "NO MATCHES FOUND" : "NO PROBLEMS YET"}
          </text>
          {!searchQuery ? (
            <box flexDirection="column" marginTop={2}>
              <text fg={theme.overlay0}>Press 'i' to initialize a new problem</text>
            </box>
          ) : null}
        </box>
      ) : (
        <box flexDirection="column" flexGrow={1} marginTop={1}>
          {filteredProblems.map((p, i) => {
            const isSelected = i === selectedIndex;
            const lang = getLanguageFromId(p.id);
            const diff = p.metadata?.difficulty ?? "?";
            const timeSpent = formatTime(p.timeSpentMs || 0);
            const isSolved = p.solved === true;
            const victoryColor = isSolved ? victoryRainbow[rainbowIndex] : undefined;

            return (
              <box key={p.id} flexDirection="row" gap={2} height={1}>
                {isSelected ? (
                  <>
                    <text fg={victoryColor ?? theme.green} attributes={TextAttributes.BOLD}>
                      {isSolved ? "✨" : "▓▓"}
                    </text>
                    <text bg={victoryColor ?? theme.green} fg={theme.crust} attributes={TextAttributes.BOLD}>
                      {` ${p.id} `}
                    </text>
                    <text bg={victoryColor ?? theme.peach} fg={theme.crust} attributes={TextAttributes.BOLD}>
                      {` ${lang.toUpperCase()} `}
                    </text>
                    <text bg={victoryColor ?? theme.mauve} fg={theme.crust} attributes={TextAttributes.BOLD}>
                      {` ${diff} `}
                    </text>
                    <text bg={victoryColor ?? theme.blue} fg={theme.crust} attributes={TextAttributes.BOLD}>
                      {` ⏱ ${timeSpent} `}
                    </text>
                    {isSolved ? (
                      <text fg={victoryColor} attributes={TextAttributes.BOLD}>✓ SOLVED</text>
                    ) : null}
                    {p.metadata?.title ? (
                      <text fg={victoryColor ?? theme.sky}>{p.metadata.title}</text>
                    ) : null}
                  </>
                ) : (
                  <>
                    <text fg={isSolved ? victoryColor : theme.surface2}>
                      {isSolved ? "✨" : "  "}
                    </text>
                    <text fg={isSolved ? victoryColor : theme.subtext0}>{p.id}</text>
                    <text fg={isSolved ? victoryColor : theme.overlay1}>{lang}</text>
                    <text fg={isSolved ? victoryColor : theme.overlay0}>{diff}</text>
                    <text fg={isSolved ? victoryColor : theme.overlay0}>{`⏱ ${timeSpent}`}</text>
                    {isSolved ? (
                      <text fg={victoryColor} attributes={TextAttributes.BOLD}>✓</text>
                    ) : null}
                  </>
                )}
              </box>
            );
          })}
        </box>
      )}

      <KeybindHelp
        keybinds={
          view === "search"
            ? [
                { key: "enter", action: "open" },
                { key: "↑↓", action: "navigate" },
                { key: "esc", action: "cancel" },
              ]
            : [
                { key: "i", action: "init" },
                { key: "/", action: "search" },
                { key: "enter", action: "open" },
                { key: "↑↓", action: "navigate" },
                { key: "d", action: "delete" },
              ]
        }
      />
    </box>
  );
}
