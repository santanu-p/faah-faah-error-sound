import * as vscode from "vscode";
import { getFaahConfig } from "./config";
import { SoundPlayer } from "./soundPlayer";

type WindowWithTerminalShellEvents = typeof vscode.window & {
  onDidEndTerminalShellExecution?: vscode.Event<vscode.TerminalShellExecutionEndEvent>;
};

export class TerminalWatcher implements vscode.Disposable {
  private readonly subscription: vscode.Disposable;

  constructor(
    private readonly soundPlayer: SoundPlayer,
    private readonly output: vscode.OutputChannel
  ) {
    const windowWithEvents = vscode.window as WindowWithTerminalShellEvents;

    if (typeof windowWithEvents.onDidEndTerminalShellExecution !== "function") {
      this.subscription = new vscode.Disposable(() => undefined);
      this.output.appendLine("[Faah] Terminal shell execution events are unavailable in this VS Code version.");
      return;
    }

    this.subscription = windowWithEvents.onDidEndTerminalShellExecution((event) => {
      void this.handleExecutionEnded(event);
    });

    this.output.appendLine("[Faah] Terminal failure watcher started.");
  }

  public dispose(): void {
    this.subscription.dispose();
  }

  private async handleExecutionEnded(event: vscode.TerminalShellExecutionEndEvent): Promise<void> {
    if (!getFaahConfig().enableTerminalFailures) {
      return;
    }

    if (event.exitCode === 0) {
      return;
    }

    const exitCode = event.exitCode === undefined ? "unknown" : String(event.exitCode);
    this.output.appendLine(`[Faah] Terminal command failed in '${event.terminal.name}' with exit code ${exitCode}.`);

    await this.soundPlayer.play("terminal");
  }
}
