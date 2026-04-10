import * as vscode from "vscode";

const CONFIG_SECTION = "faahSound";

export type SoundSource = "editor" | "terminal" | "manual";

export interface FaahConfig {
  enableEditorDiagnostics: boolean;
  enableTerminalFailures: boolean;
  soundPath: string;
  editorSoundPath: string;
  terminalSoundPath: string;
  combineClipCount: number;
}

export function getFaahConfig(): FaahConfig {
  const configuration = vscode.workspace.getConfiguration(CONFIG_SECTION);

  return {
    enableEditorDiagnostics: configuration.get<boolean>("enableEditorDiagnostics", true),
    enableTerminalFailures: configuration.get<boolean>("enableTerminalFailures", true),
    soundPath: getTrimmedStringSetting(configuration, "soundPath"),
    editorSoundPath: getTrimmedStringSetting(configuration, "editorSoundPath"),
    terminalSoundPath: getTrimmedStringSetting(configuration, "terminalSoundPath"),
    combineClipCount: getBoundedIntegerSetting(configuration, "combineClipCount", 3, 1, 10)
  };
}

export function resolveConfiguredSoundPath(source: SoundSource, config: FaahConfig): string | undefined {
  if (source === "editor" && config.editorSoundPath.length > 0) {
    return config.editorSoundPath;
  }

  if (source === "terminal" && config.terminalSoundPath.length > 0) {
    return config.terminalSoundPath;
  }

  if (config.soundPath.length > 0) {
    return config.soundPath;
  }

  return undefined;
}

function getTrimmedStringSetting(configuration: vscode.WorkspaceConfiguration, key: string): string {
  return configuration.get<string>(key, "").trim();
}

function getBoundedIntegerSetting(
  configuration: vscode.WorkspaceConfiguration,
  key: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = configuration.get<number>(key, fallback);
  if (!Number.isFinite(raw)) {
    return fallback;
  }

  const value = Math.trunc(raw);
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}
