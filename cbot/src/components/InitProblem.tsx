import { useState, useCallback } from "react";
import { useKeyboard } from "@opentui/react";
import { TextAttributes, type PasteEvent } from "@opentui/core";
import { KeybindHelp } from "./KeybindHelp";
import { initProblem, theme } from "../lib";

interface InitProblemProps {
  onDone: () => void;
  onCancel: () => void;
}

export function InitProblem({ onDone, onCancel }: InitProblemProps) {
  const [input, setInput] = useState("");
  const [lang, setLang] = useState<"python" | "cpp">("cpp");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await initProblem(input, lang);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [input, lang, onDone]);

  useKeyboard((key) => {
    if (key.name === "escape") {
      onCancel();
    } else if (key.name === "tab") {
      setLang((l) => (l === "python" ? "cpp" : "python"));
    }
  });

  return (
    <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2}>
      <box flexDirection="row" gap={1} height={1}>
        <text fg={theme.blue} attributes={TextAttributes.BOLD}>▓▓</text>
        <text fg={theme.sapphire} attributes={TextAttributes.BOLD}>▓▓</text>
        <text fg={theme.sky} attributes={TextAttributes.BOLD}>INIT PROBLEM</text>
      </box>
      <text fg={theme.blue}>{"▀".repeat(78)}</text>

      <box flexDirection="column" marginTop={2} gap={1}>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>PROBLEM URL OR ID</text>
        <input
          focused
          placeholder="1A or https://codeforces.com/contest/1/problem/A"
          value={input}
          onInput={setInput}
          onSubmit={handleSubmit}
          onPaste={(event: PasteEvent) => {
            setInput(event.text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim());
          }}
        />
        <text fg={theme.overlay0}>Shift+Insert or Ctrl+Shift+V to paste</text>
      </box>

      <box flexDirection="row" gap={2} marginTop={2}>
        <text fg={theme.overlay0}>LANGUAGE</text>
        <text
          bg={lang === "python" ? theme.blue : undefined}
          fg={lang === "python" ? theme.crust : theme.overlay1}
          attributes={lang === "python" ? TextAttributes.BOLD : undefined}
        >
          {lang === "python" ? "  PYTHON  " : "  python  "}
        </text>
        <text
          bg={lang === "cpp" ? theme.blue : undefined}
          fg={lang === "cpp" ? theme.crust : theme.overlay1}
          attributes={lang === "cpp" ? TextAttributes.BOLD : undefined}
        >
          {lang === "cpp" ? "  C++  " : "  c++  "}
        </text>
      </box>

      {loading ? (
        <box flexDirection="row" gap={1} marginTop={2}>
          <text fg={theme.blue} attributes={TextAttributes.BOLD}>⟳</text>
          <text fg={theme.blue}>DOWNLOADING...</text>
        </box>
      ) : null}

      {error ? (
        <box flexDirection="column" marginTop={2}>
          <text bg={theme.red} fg={theme.text} attributes={TextAttributes.BOLD}> ERROR </text>
          <text fg={theme.red}>{error}</text>
        </box>
      ) : null}

      <box flexGrow={1} />
      <KeybindHelp
        keybinds={[
          { key: "enter", action: "init" },
          { key: "tab", action: "switch lang" },
          { key: "shift+ins", action: "paste" },
          { key: "esc", action: "cancel" },
        ]}
      />
    </box>
  );
}
