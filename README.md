# Voice Messages for VS Code

Record and attach voice messages as comments in your code. Perfect for code reviews, documentation, or leaving notes for yourself and teammates.

## Features

- **Quick Recording** - Start recording from the status bar or command palette
- **Optional Titles** - Add descriptive titles to your voice messages
- **Inline Playback** - Play messages directly from CodeLens buttons in the editor
- **Keyboard Shortcut** - Toggle recording with `Ctrl+Shift+V` (Mac: `Cmd+Shift+V`)

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
2. Click the **🎤 Voice** button in the status bar, or:
   - Use the keyboard shortcut `Ctrl+Shift+V` (Mac: `Cmd+Shift+V`)
   - Run "Voice Messages: Start Recording" from the Command Palette
3. Optionally enter a title for the message
4. Speak your message
5. Click the status bar again or run "Stop Recording" to save

A comment marker will be inserted at your cursor position:
```javascript
// 🎤 voice:abc123-def456
function complexAlgorithm() {
    // Your code here
}
```

The UUID is automatically hidden and replaced with the title or timestamp.

### Playing Voice Messages

- Click **▶️ Load Voice Message** on any marker line
- The audio player appears in the Explorer sidebar
- Use space/enter to play/pause, or click the progress bar to seek

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

## Storage

Voice messages are stored in `.voice-messages/` at your workspace root:
```
.voice-messages/
├── index.json    # Message metadata
└── audio/        # MP3 audio files
```

**Tip:** Add `.voice-messages/` to your `.gitignore` unless you want to share recordings with your team.

## Supported Languages

Voice message markers work with 60+ languages including:
JavaScript, TypeScript, Python, Ruby, Go, Rust, Java, C/C++, C#, PHP, Swift, Kotlin, HTML, CSS, SQL, Shell scripts, YAML, Markdown, and many more.

## Known Issues

- Recording requires FFmpeg to be in your system PATH
- Audio playback requires VS Code's webview to have access to local files

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for release history.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
