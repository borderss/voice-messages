/**
 * Represents a voice message attached to a specific location in code
 */
export interface VoiceMessage {
    /** Unique identifier (UUID) */
    id: string;
    /** Relative path to audio file within storage */
    audioFileName: string;
    /** The document URI where this message is attached */
    documentUri: string;
    /** Line number (0-indexed) where the marker comment is placed */
    line: number;
    /** ISO timestamp when the message was created */
    createdAt: string;
    /** Duration in seconds (optional, populated after recording) */
    duration?: number;
    /** Optional label/description for the message */
    label?: string;
}

/**
 * Audio device information
 */
export interface AudioDevice {
    /** Device identifier (platform-specific) */
    id: string;
    /** Human-readable device name */
    name: string;
    /** Whether this is the default device */
    isDefault: boolean;
}

/**
 * Recording options
 */
export interface RecordingOptions {
    /** Output file path */
    outputPath: string;
    /** Audio device to use (platform-specific identifier) */
    device?: string;
    /** Audio codec (default: libmp3lame) */
    codec?: string;
    /** Audio bitrate (default: 128k) */
    bitrate?: string;
    /** Sample rate in Hz (default: 44100) */
    sampleRate?: number;
    /** Number of channels (default: 1 for mono) */
    channels?: number;
}

/**
 * Recording state
 */
export type RecordingState = 'idle' | 'recording' | 'stopping';

/**
 * Platform type for FFMPEG commands
 */
export type Platform = 'win32' | 'darwin' | 'linux';

/**
 * FFMPEG installation instructions per platform
 */
export const FFMPEG_INSTALL_INSTRUCTIONS: Record<Platform, { command: string; url: string }> = {
    win32: {
        command: 'winget install ffmpeg',
        url: 'https://www.gyan.dev/ffmpeg/builds/'
    },
    darwin: {
        command: 'brew install ffmpeg',
        url: 'https://formulae.brew.sh/formula/ffmpeg'
    },
    linux: {
        command: 'sudo apt install ffmpeg',
        url: 'https://ffmpeg.org/download.html#build-linux'
    }
};
