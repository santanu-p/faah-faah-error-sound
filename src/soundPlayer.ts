import { execFile } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import * as vscode from "vscode";
import { getFaahConfig, resolveConfiguredSoundPath, SoundSource } from "./config";

const execFileAsync = promisify(execFile);

export class SoundPlayer {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly output: vscode.OutputChannel
  ) {}

  public async play(source: SoundSource): Promise<void> {
    const config = getFaahConfig();

    const soundPath = this.resolveSoundPath(source, config);

    try {
      if (soundPath) {
        await this.playMp3File(soundPath);
      } else {
        await this.playFallbackBeep();
      }
    } catch (error) {
      this.output.appendLine(`[Faah] Playback failed: ${getErrorMessage(error)}`);
    }
  }

  private resolveSoundPath(source: SoundSource, config: ReturnType<typeof getFaahConfig>): string | undefined {
    const configuredPath = resolveConfiguredSoundPath(source, config);

    if (configuredPath) {
      const configuredCandidates = this.collectMp3Files(configuredPath);
      if (configuredCandidates.length > 0) {
        return pickRandom(configuredCandidates);
      }

      this.output.appendLine(`[Faah] Configured sound file not found: ${configuredPath}`);
    }

    const bundledAudioDir = vscode.Uri.joinPath(this.context.extensionUri, "audio").fsPath;
    const bundledCandidates = this.collectMp3Files(bundledAudioDir);
    if (bundledCandidates.length > 0) {
      return pickRandom(bundledCandidates);
    }

    const bundledPath = vscode.Uri.joinPath(this.context.extensionUri, "assets", "default.mp3").fsPath;
    if (existsSync(bundledPath)) {
      return bundledPath;
    }

    return undefined;
  }

  private collectMp3Files(targetPath: string): string[] {
    if (!existsSync(targetPath)) {
      return [];
    }

    try {
      const stats = statSync(targetPath);
      if (stats.isFile()) {
        return extname(targetPath).toLowerCase() === ".mp3" ? [targetPath] : [];
      }

      if (!stats.isDirectory()) {
        return [];
      }

      return collectMp3FilesFromDirectory(targetPath);
    } catch (error) {
      this.output.appendLine(`[Faah] Could not inspect sound path '${targetPath}': ${getErrorMessage(error)}`);
      return [];
    }
  }

  private async playMp3File(filePath: string): Promise<void> {
    if (process.platform !== "win32") {
      await this.playFallbackBeep();
      return;
    }

    const escapedPath = escapePowerShellSingleQuotedString(filePath);
    const script = [
      `$p = '${escapedPath}'`,
      "Add-Type -AssemblyName PresentationCore",
      "$player = New-Object System.Windows.Media.MediaPlayer",
      "$player.Open([Uri]$p)",
      "$player.Volume = 1.0",
      "$player.Play()",
      "Start-Sleep -Milliseconds 950",
      "$player.Close()"
    ].join("; ");

    await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Sta", "-Command", script],
      { windowsHide: true, timeout: 5000 }
    );
  }

  private async playFallbackBeep(): Promise<void> {
    if (process.platform !== "win32") {
      this.output.appendLine("[Faah] No bundled or configured MP3 found.");
      return;
    }

    const script = "[console]::Beep(530,120); Start-Sleep -Milliseconds 70; [console]::Beep(450,120)";

    await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true, timeout: 3000 }
    );
  }
}

function escapePowerShellSingleQuotedString(value: string): string {
  return value.replace(/'/g, "''");
}

function collectMp3FilesFromDirectory(directoryPath: string): string[] {
  const queue: string[] = [directoryPath];
  const files: string[] = [];

  while (queue.length > 0) {
    const currentDir = queue.shift();
    if (!currentDir) {
      continue;
    }

    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }

      if (entry.isFile() && extname(entry.name).toLowerCase() === ".mp3") {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function pickRandom<T>(items: readonly T[]): T {
  const index = Math.floor(Math.random() * items.length);
  return items[index];
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
