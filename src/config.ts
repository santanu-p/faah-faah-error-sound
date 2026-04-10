import * as vscode from "vscode";

const CONFIG_SECTION = "faahSound";

export type SoundSource = "editor" | "terminal" | "manual";

export interface FaahConfig {
  enableEditorDiagnostics: boolean;
  enableTerminalFailures: boolean;
  soundPath: string;
  editorSoundPath: string;
  terminalSoundPath: string;
}

export function getFaahConfig(): FaahConfig {
  const configuration = vscode.workspace.getConfiguration(CONFIG_SECTION);

  return {
    enableEditorDiagnostics: configuration.get<boolean>("enableEditorDiagnostics", true),
    enableTerminalFailures: configuration.get<boolean>("enableTerminalFailures", true),
    soundPath: getTrimmedStringSetting(configuration, "soundPath"),
    editorSoundPath: getTrimmedStringSetting(configuration, "editorSoundPath"),
    terminalSoundPath: getTrimmedStringSetting(configuration, "terminalSoundPath")
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
