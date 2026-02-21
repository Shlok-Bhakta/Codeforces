import { TextAttributes } from "@opentui/core";
import { theme } from "../lib";

interface KeybindHelpProps {
  keybinds: { key: string; action: string }[];
}

export function KeybindHelp({ keybinds }: KeybindHelpProps) {
  return (
    <box flexDirection="row" gap={2} paddingTop={1} flexShrink={0}>
      {keybinds.map((kb, i) => (
        <box key={i} flexDirection="row" gap={1}>
          <text bg={theme.surface1} fg={theme.green} attributes={TextAttributes.BOLD}> {kb.key} </text>
          <text fg={theme.overlay0}>{kb.action}</text>
          {i < keybinds.length - 1 && <text fg={theme.surface1}>│</text>}
        </box>
      ))}
    </box>
  );
}
