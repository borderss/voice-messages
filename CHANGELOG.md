# Changelog

All notable changes to the Voice Messages extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024

### Added

- Initial release of Voice Messages for VS Code
- Record voice messages using FFmpeg with cross-platform support (Windows, macOS, Linux)
- Language-aware comment markers for 60+ programming languages
- Optional titles for voice messages
- Inline playback via CodeLens buttons
- Audio player in the Explorer sidebar
- Text decorations that hide UUIDs and show titles/timestamps
- Keyboard shortcut (Ctrl+Shift+V / Cmd+Shift+V) for toggle recording
- Status bar integration with recording state indicators
- Configurable audio device selection
- Settings for audio codec and bitrate
- Cleanup tools for orphaned markers and audio files
- Per-workspace storage in `.voice-messages/` folder