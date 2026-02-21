import { useKeyboard } from "@opentui/react";
import { TextAttributes } from "@opentui/core";
import { KeybindHelp } from "./KeybindHelp";
import { removeProblem, theme, type Problem } from "../lib";

interface DeleteConfirmProps {
  problem: Problem;
  onDone: () => void;
  onCancel: () => void;
}

export function DeleteConfirm({ problem, onDone, onCancel }: DeleteConfirmProps) {
  useKeyboard(async (key) => {
    if (key.name === "escape" || key.name === "n") {
      onCancel();
    } else if (key.name === "y") {
      await removeProblem(problem.id);
      onDone();
    }
  });

  return (
    <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2}>
      <box flexDirection="row" gap={1} height={1}>
        <text fg={theme.red} attributes={TextAttributes.BOLD}>▓▓</text>
        <text fg={theme.maroon} attributes={TextAttributes.BOLD}>▓▓</text>
        <text fg={theme.red} attributes={TextAttributes.BOLD}>DELETE PROBLEM</text>
      </box>
      <text fg={theme.red}>{"▀".repeat(78)}</text>

      <box flexDirection="column" marginTop={2} gap={2}>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          {`DELETE "${problem.id}"?`}
        </text>
        <text fg={theme.overlay0}>This will permanently remove all files.</text>
        <text fg={theme.overlay0}>This action cannot be undone.</text>
      </box>

      <box flexGrow={1} />
      <KeybindHelp
        keybinds={[
          { key: "y", action: "yes, delete" },
          { key: "n", action: "no" },
          { key: "esc", action: "cancel" },
        ]}
      />
    </box>
  );
}
