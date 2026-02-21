import { spawn } from "bun";

export async function copyToClipboard(text: string): Promise<void> {
  try {
    const proc = spawn(["wl-copy"], {
      stdin: "pipe",
    });
    
    if (proc.stdin) {
      const writer = proc.stdin.getWriter();
      await writer.write(new TextEncoder().encode(text));
      await writer.close();
    }
    
    await proc.exited;
  } catch (error) {
    throw new Error("Failed to copy to clipboard. Is wl-copy installed?");
  }
}

export async function pasteFromClipboard(): Promise<string> {
  try {
    const proc = spawn(["wl-paste", "-n"], {
      stdout: "pipe",
    });
    
    const text = await new Response(proc.stdout).text();
    await proc.exited;
    
    return text;
  } catch (error) {
    throw new Error("Failed to paste from clipboard. Is wl-paste installed?");
  }
}
