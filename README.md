# Faah Faah Error Sound

VS Code extension that plays a funny sound when:

- editor diagnostics get new errors
- a terminal command exits with a non-zero status

## Current behavior

- Windows-first audio playback using built-in PowerShell APIs
- No rate limiting: each matching error trigger plays immediately
- Random MP3 selection from bundled `audio/` folder (including subfolders)
- Command: `Faah Sound: Test Sound`

## Add your MP3 files later

Set one or more settings in VS Code:

- `faahSound.soundPath`
- `faahSound.editorSoundPath`
- `faahSound.terminalSoundPath`

Each setting can point to either a single MP3 file or a folder containing MP3 files.

If no settings are provided, the extension automatically uses bundled MP3 files from `audio/`.

If no MP3 path is valid, it falls back to a short beep pattern.

## Build

1. `npm install`
2. `npm run compile`
3. Press `F5` in VS Code to launch the Extension Development Host
