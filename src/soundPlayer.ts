import { execFile } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import * as vscode from "vscode";
import { getFaahConfig, resolveConfiguredSoundPath, SoundSource } from "./config";

const execFileAsync = promisify(execFile);
const PER_CLIP_TIMEOUT_MS = 4000;
const PLAYBACK_TIMEOUT_BUFFER_MS = 1000;
const FALLBACK_CLIP_PLAY_MS = 950;
const CLIP_DURATION_BUFFER_MS = 50;
const MIN_CLIP_SLEEP_MS = 200;
const MAX_CLIP_SLEEP_MS = 5000;

export class SoundPlayer {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly output: vscode.OutputChannel
  ) {}

  public async play(source: SoundSource): Promise<void> {
    const config = getFaahConfig();

    const soundPaths = this.resolveSoundPaths(source, config);

    try {
      if (soundPaths.length > 0) {
        await this.playMp3Files(soundPaths);
      } else {
        await this.playFallbackBeep();
      }
    } catch (error) {
      this.output.appendLine(`[Faah] Playback failed: ${getErrorMessage(error)}`);
    }
  }

  private resolveSoundPaths(source: SoundSource, config: ReturnType<typeof getFaahConfig>): string[] {
    const configuredPath = resolveConfiguredSoundPath(source, config);

    if (configuredPath) {
      const configuredCandidates = this.collectMp3Files(configuredPath);
      if (configuredCandidates.length > 0) {
        return pickRandomSequence(configuredCandidates, config.combineClipCount);
      }

      this.output.appendLine(`[Faah] Configured sound file not found: ${configuredPath}`);
    }

    const bundledAudioDir = vscode.Uri.joinPath(this.context.extensionUri, "audio").fsPath;
    const bundledCandidates = this.collectMp3Files(bundledAudioDir);
    if (bundledCandidates.length > 0) {
      return pickRandomSequence(bundledCandidates, config.combineClipCount);
    }

    const bundledPath = vscode.Uri.joinPath(this.context.extensionUri, "assets", "default.mp3").fsPath;
    if (existsSync(bundledPath)) {
      return [bundledPath];
    }

    return [];
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

  private async playMp3Files(filePaths: readonly string[]): Promise<void> {
    if (process.platform !== "win32") {
      await this.playFallbackBeep();
      return;
    }

    const escapedPaths = filePaths.map((path) => `'${escapePowerShellSingleQuotedString(path)}'`).join(", ");
    const script = [
      `$paths = @(${escapedPaths})`,
      "Add-Type -AssemblyName PresentationCore",
      "$player = New-Object System.Windows.Media.MediaPlayer",
      "foreach ($path in $paths) {",
      "  $player.Open([Uri]$path)",
      "  $player.Volume = 1.0",
      "  $player.Play()",
      "  $waited = 0",
      "  while (-not $player.NaturalDuration.HasTimeSpan -and $waited -lt 2000) {",
      "    Start-Sleep -Milliseconds 50",
      "    $waited += 50",
      "  }",
      `  $durationMs = if ($player.NaturalDuration.HasTimeSpan) { [int][Math]::Ceiling($player.NaturalDuration.TimeSpan.TotalMilliseconds) } else { ${FALLBACK_CLIP_PLAY_MS} }`,
      `  Start-Sleep -Milliseconds ([Math]::Max(${MIN_CLIP_SLEEP_MS}, [Math]::Min(${MAX_CLIP_SLEEP_MS}, $durationMs + ${CLIP_DURATION_BUFFER_MS})))`,
      "  $player.Stop()",
      "}",
      "$player.Close()"
    ].join("; ");

    await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Sta", "-Command", script],
      {
        windowsHide: true,
        timeout: Math.max(5000, filePaths.length * PER_CLIP_TIMEOUT_MS + PLAYBACK_TIMEOUT_BUFFER_MS)
      }
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

function pickRandomSequence<T>(items: readonly T[], count: number): T[] {
  if (items.length === 0 || count <= 0) {
    return [];
  }

  const picked: T[] = [];

  while (picked.length < count) {
    const cycle = shuffle(items);
    for (const item of cycle) {
      picked.push(item);
      if (picked.length >= count) {
        break;
      }
    }
  }

  return picked;
}

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }

  return copy;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
