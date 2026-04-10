import * as vscode from "vscode";
import { getFaahConfig } from "./config";
import { SoundPlayer } from "./soundPlayer";

export class DiagnosticsWatcher implements vscode.Disposable {
  private readonly previousErrorCountByUri = new Map<string, number>();
  private readonly subscription: vscode.Disposable;

  constructor(
    private readonly soundPlayer: SoundPlayer,
    private readonly output: vscode.OutputChannel
  ) {
    this.captureInitialState();
    this.subscription = vscode.languages.onDidChangeDiagnostics((event) => {
      void this.handleDiagnosticsChanged(event);
    });
  }

  public dispose(): void {
    this.subscription.dispose();
    this.previousErrorCountByUri.clear();
  }

  private captureInitialState(): void {
    for (const [uri, diagnostics] of vscode.languages.getDiagnostics()) {
      this.previousErrorCountByUri.set(uri.toString(), this.countErrors(diagnostics));
    }
  }

  private async handleDiagnosticsChanged(event: vscode.DiagnosticChangeEvent): Promise<void> {
    if (!getFaahConfig().enableEditorDiagnostics) {
      return;
    }

    let hasNewErrors = false;

    for (const uri of event.uris) {
      const uriKey = uri.toString();
      const nextErrorCount = this.countErrors(vscode.languages.getDiagnostics(uri));
      const previousErrorCount = this.previousErrorCountByUri.get(uriKey) ?? 0;

      if (nextErrorCount > previousErrorCount && nextErrorCount > 0) {
        hasNewErrors = true;
      }

      if (nextErrorCount === 0) {
        this.previousErrorCountByUri.delete(uriKey);
      } else {
        this.previousErrorCountByUri.set(uriKey, nextErrorCount);
      }
    }

    if (hasNewErrors) {
      this.output.appendLine("[Faah] Editor diagnostics reported new errors.");
      await this.soundPlayer.play("editor");
    }
  }

  private countErrors(diagnostics: readonly vscode.Diagnostic[]): number {
    return diagnostics.filter((diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Error).length;
  }
}
