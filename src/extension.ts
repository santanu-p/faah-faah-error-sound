import * as vscode from "vscode";
import { DiagnosticsWatcher } from "./diagnosticsWatcher";
import { SoundPlayer } from "./soundPlayer";
import { TerminalWatcher } from "./terminalWatcher";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Faah Sound");
  output.appendLine("[Faah] Extension activated.");

  const soundPlayer = new SoundPlayer(context, output);
  const diagnosticsWatcher = new DiagnosticsWatcher(soundPlayer, output);
  const terminalWatcher = new TerminalWatcher(soundPlayer, output);

  const testSoundCommand = vscode.commands.registerCommand("faahSound.testSound", async () => {
    await soundPlayer.play("manual");
    void vscode.window.setStatusBarMessage("Faah sound played", 1500);
  });

  context.subscriptions.push(output, diagnosticsWatcher, terminalWatcher, testSoundCommand);
}

export function deactivate(): void {
  // Nothing to clean up manually. VS Code disposes subscriptions.
}
