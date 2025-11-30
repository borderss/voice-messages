# Voice Messages for VS Code

**Add voice comments to your code** — Record audio messages and attach them directly to lines in your codebase. Perfect for async code reviews, explaining complex logic, onboarding new team members, or leaving yourself detailed notes.

## Why Voice Messages?

- **Decentralized** — No servers, no accounts, no API keys. Everything runs locally on your machine.
- **Git-Friendly** — Audio files are stored in your repository. Commit them alongside your code and share with your team.
- **Works Without the Extension** — Teammates can play the MP3 files directly from the `.voice-messages/audio/` folder, even without VS Code or this extension installed.
- **Zero Configuration** — Just install FFmpeg and start recording. No setup required.

## Features

- **Quick Recording** — Start recording from the status bar or command palette
- **Optional Titles** — Add descriptive titles to your voice messages
- **Inline Playback** — Play messages directly from CodeLens buttons in the editor
- **Keyboard Shortcut** — Toggle recording with `Ctrl+Shift+V` (Mac: `Cmd+Shift+V`)
- **Language-Aware Markers** — Automatically uses the correct comment syntax for 60+ languages
- **Clean Display** — UUIDs are hidden, showing only the title or timestamp

## Prerequisites

### FFmpeg (Required)

This extension requires FFmpeg to be installed on your system for audio recording.

#### Windows

```powershell
winget install ffmpeg
```

Or download from [gyan.dev/ffmpeg/builds](https://www.gyan.dev/ffmpeg/builds/)

#### macOS

```bash
brew install ffmpeg
```

#### Linux (Debian/Ubuntu)

```bash
sudo apt install ffmpeg
```

#### Linux (Fedora)

```bash
sudo dnf install ffmpeg
```

#### Linux (Arch)

```bash
sudo pacman -S ffmpeg
```

After installation, verify FFmpeg is available by running `ffmpeg -version` in your terminal.

## Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Voice Messages"
4. Click Install

Or install from the command line:

```bash
code --install-extension voice-messages
```

## Usage

### Recording a Voice Message

1. Place your cursor where you want to attach the voice message
2. Click the **Voice** button in the status bar, or:
   - Use the keyboard shortcut `Ctrl+Shift+V` (Mac: `Cmd+Shift+V`)
   - Run "Voice Messages: Start Recording" from the Command Palette `Ctrl+Shift+P`
3. Optionally enter a title for the message
4. Speak your message
5. Click the status bar again, just press enter, or run "Stop Recording" to save

A comment marker will be inserted at your cursor position:

```javascript
// 🎤 voice:019ad2b8-a0bb-710a-9ebf-7022cea015be
function complexAlgorithm() {
    // Your code here
}
```

The UUID is automatically hidden and replaced with the title or timestamp.

### Playing Voice Messages

- Click **▶️ Load Voice Message** on any marker line
- The audio player appears in the Explorer sidebar
- Use space/enter to play/pause, or manually click the play button to play
- Use the timeline to seek within the message

### Deleting Voice Messages

- Click **🗑️ Delete** on the marker line
- Confirms before deleting the audio file and removing the marker

### Selecting Audio Device

Run "Voice Messages: Select Audio Device" to choose a specific microphone.

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `voice-messages.audioDevice` | `auto` | Audio input device. Set to `auto` for system default |
| `voice-messages.audioCodec` | `libmp3lame` | Audio codec (libmp3lame, aac, libvorbis, flac) |
| `voice-messages.audioBitrate` | `64k` | Recording bitrate (32k-192k). 64k recommended for voice |

## Commands

| Command | Description |
|---------|-------------|
| Voice Messages: Start Recording | Begin recording a voice message |
| Voice Messages: Stop Recording | Stop and save the current recording |
| Voice Messages: Cancel Recording | Stop recording without saving |
| Voice Messages: Toggle Recording | Start or stop recording |
| Voice Messages: Select Audio Device | Choose audio input device |
| Voice Messages: Remove Orphaned Marker | Remove a marker with missing audio |
| Voice Messages: Delete Unreferenced Audio Files | Clean up orphaned audio files |

## Storage & Sharing

Voice messages are stored in `.voice-messages/` at your workspace root:

```text
.voice-messages/
├── index.json    # Message metadata
└── audio/        # MP3 audio files
```

### Sharing with Your Team

**Commit the `.voice-messages/` folder to Git** to share voice messages with your team:

- Teammates with the extension get the full inline experience
- Teammates *without* the extension can still play the MP3 files directly from the `audio/` folder
- Works with any Git hosting (GitHub, GitLab, Bitbucket, etc.)

### Keeping Messages Private

Add `.voice-messages/` to your `.gitignore` if you want to keep recordings local.

## Supported Languages

Voice message markers work with 60+ languages including:
JavaScript, TypeScript, Python, Go, Ruby, Rust, Java, C/C++, C#, PHP, Swift, Kotlin, HTML, CSS, SQL, Shell scripts, YAML, Markdown, and many more.

## Known Issues

- Recording requires FFmpeg to be in your system PATH
- Audio playback being from the webview forces user to interact with it before playing audio *e.g. can't directly play the sound from the editor interaction with the inline buttons.*

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for release history.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
