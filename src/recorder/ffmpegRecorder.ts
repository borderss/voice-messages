import { spawn, ChildProcess, execSync } from 'child_process';
import * as vscode from 'vscode';
import { AudioDevice, RecordingOptions, RecordingState, Platform, FFMPEG_INSTALL_INSTRUCTIONS } from '../types';

/**
 * FFMPEG-based audio recorder service
 */
export class FFmpegRecorder {
    private process: ChildProcess | null = null;
    private state: RecordingState = 'idle';
    private currentOutputPath: string = '';
    private recordingStartTime: number = 0;

    private readonly onStateChangeEmitter = new vscode.EventEmitter<RecordingState>();
    public readonly onStateChange = this.onStateChangeEmitter.event;

    /**
     * Check if FFMPEG is installed and available
     */
    public static async isAvailable(): Promise<boolean> {
        try {
            execSync('ffmpeg -version', { stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Show installation prompt if FFMPEG is not available
     */
    public static async promptInstallation(): Promise<boolean> {
        const platform = process.platform as Platform;
        const instructions = FFMPEG_INSTALL_INSTRUCTIONS[platform] || FFMPEG_INSTALL_INSTRUCTIONS.linux;

        const selection = await vscode.window.showWarningMessage(
            'FFMPEG is required for voice recording but was not found on your system.',
            'Copy Install Command',
            'Open Download Page',
            'Cancel'
        );

        if (selection === 'Copy Install Command') {
            await vscode.env.clipboard.writeText(instructions.command);
            vscode.window.showInformationMessage(`Install command copied: ${instructions.command}`);
            return false;
        } else if (selection === 'Open Download Page') {
            await vscode.env.openExternal(vscode.Uri.parse(instructions.url));
            return false;
        }

        return false;
    }

    /**
     * Get the current recording state
     */
    public getState(): RecordingState {
        return this.state;
    }

    /**
     * List available audio input devices
     */
    public async listDevices(): Promise<AudioDevice[]> {
        const platform = process.platform as Platform;

        try {
            if (platform === 'win32') {
                return await this.listWindowsDevices();
            } else if (platform === 'darwin') {
                return await this.listMacDevices();
            } else {
                return await this.listLinuxDevices();
            }
        } catch (error) {
            console.error('Failed to list audio devices:', error);
            return [];
        }
    }

    private async listWindowsDevices(): Promise<AudioDevice[]> {
        return new Promise((resolve) => {
            const devices: AudioDevice[] = [];
            const proc = spawn('ffmpeg', ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            proc.stderr?.on('data', (data: Buffer) => {
                output += data.toString();
            });

            proc.on('close', () => {
                const lines = output.split('\n');
                let inAudioSection = false;

                for (const line of lines) {
                    if (line.includes('DirectShow audio devices')) {
                        inAudioSection = true;
                        continue;
                    }
                    if (line.includes('DirectShow video devices')) {
                        inAudioSection = false;
                        continue;
                    }
                    if (inAudioSection) {
                        const match = line.match(/"([^"]+)"/);
                        if (match && !line.includes('Alternative name')) {
                            devices.push({
                                id: match[1],
                                name: match[1],
                                isDefault: devices.length === 0
                            });
                        }
                    }
                }

                resolve(devices);
            });

            proc.on('error', () => resolve([]));
        });
    }

    private async listMacDevices(): Promise<AudioDevice[]> {
        return new Promise((resolve) => {
            const devices: AudioDevice[] = [];
            const proc = spawn('ffmpeg', ['-f', 'avfoundation', '-list_devices', 'true', '-i', ''], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            proc.stderr?.on('data', (data: Buffer) => {
                output += data.toString();
            });

            proc.on('close', () => {
                const lines = output.split('\n');
                let inAudioSection = false;

                for (const line of lines) {
                    if (line.includes('AVFoundation audio devices')) {
                        inAudioSection = true;
                        continue;
                    }
                    if (inAudioSection) {
                        const match = line.match(/\[(\d+)\]\s+(.+)/);
                        if (match) {
                            devices.push({
                                id: `:${match[1]}`,
                                name: match[2].trim(),
                                isDefault: devices.length === 0
                            });
                        }
                    }
                }

                resolve(devices);
            });

            proc.on('error', () => resolve([]));
        });
    }

    private async listLinuxDevices(): Promise<AudioDevice[]> {
        return new Promise((resolve) => {
            const devices: AudioDevice[] = [];

            const proc = spawn('pactl', ['list', 'sources', 'short'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            proc.stdout?.on('data', (data: Buffer) => {
                output += data.toString();
            });

            proc.on('close', () => {
                const lines = output.split('\n');
                for (const line of lines) {
                    const parts = line.split('\t');
                    if (parts.length >= 2) {
                        const id = parts[1];
                        if (!id.includes('.monitor')) {
                            devices.push({
                                id: id,
                                name: id,
                                isDefault: devices.length === 0
                            });
                        }
                    }
                }

                if (devices.length === 0) {
                    devices.push({
                        id: 'default',
                        name: 'Default Audio Input',
                        isDefault: true
                    });
                }

                resolve(devices);
            });

            proc.on('error', () => {
                resolve([{
                    id: 'default',
                    name: 'Default Audio Input',
                    isDefault: true
                }]);
            });
        });
    }

    /**
     * Get the default device or user-configured device
     */
    public async getPreferredDevice(): Promise<string | undefined> {
        const config = vscode.workspace.getConfiguration('voice-messages');
        const configuredDevice = config.get<string>('audioDevice');

        if (configuredDevice && configuredDevice !== 'auto') {
            return configuredDevice;
        }

        return undefined;
    }

    /**
     * Start recording audio
     */
    public async startRecording(options: RecordingOptions): Promise<void> {
        if (this.state !== 'idle') {
            throw new Error('Recording already in progress');
        }

        const isAvailable = await FFmpegRecorder.isAvailable();
        if (!isAvailable) {
            await FFmpegRecorder.promptInstallation();
            throw new Error('FFMPEG is not installed');
        }

        this.currentOutputPath = options.outputPath;
        const args = this.buildRecordingArgs(options);

        return new Promise((resolve, reject) => {
            this.process = spawn('ffmpeg', args, {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let errorOutput = '';

            this.process.stderr?.on('data', (data: Buffer) => {
                const text = data.toString();
                errorOutput += text;
            });

            this.process.on('error', (err: Error) => {
                this.setState('idle');
                reject(new Error(`Failed to start FFMPEG: ${err.message}`));
            });

            setTimeout(() => {
                if (this.process && !this.process.killed) {
                    this.recordingStartTime = Date.now();
                    this.setState('recording');
                    resolve();
                } else {
                    reject(new Error(`FFMPEG failed to start: ${errorOutput}`));
                }
            }, 500);

            this.process.on('close', (_code: number | null) => {
                this.setState('idle');
            });
        });
    }

    /**
     * Stop recording and return the output file path and duration
     */
    public async stopRecording(): Promise<{ path: string; duration: number }> {
        if (this.state !== 'recording') {
            throw new Error('No recording in progress');
        }

        this.setState('stopping');

        return new Promise((resolve, reject) => {
            if (!this.process) {
                this.setState('idle');
                reject(new Error('No recording process'));
                return;
            }

            const outputPath = this.currentOutputPath;
            const duration = (Date.now() - this.recordingStartTime) / 1000;

            const timeout = setTimeout(() => {
                if (this.process && !this.process.killed) {
                    this.process.kill('SIGTERM');
                }
            }, 3000);

            this.process.on('close', () => {
                clearTimeout(timeout);
                this.process = null;
                this.setState('idle');
                resolve({ path: outputPath, duration });
            });

            this.process.stdin?.write('q');
            this.process.stdin?.end();
        });
    }

    /**
     * Cancel recording without saving
     */
    public async cancelRecording(): Promise<void> {
        if (this.state === 'idle') {
            return;
        }

        if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
        }

        this.process = null;
        this.setState('idle');
    }

    private setState(state: RecordingState): void {
        this.state = state;
        this.onStateChangeEmitter.fire(state);
    }

    private buildRecordingArgs(options: RecordingOptions): string[] {
        const platform = process.platform as Platform;
        const args: string[] = [];

        if (platform === 'win32') {
            args.push('-f', 'dshow');
            const device = options.device || 'Microphone';
            args.push('-i', `audio=${device}`);
        } else if (platform === 'darwin') {
            args.push('-f', 'avfoundation');
            const device = options.device || ':default';
            args.push('-i', device);
        } else {
            args.push('-f', 'pulse');
            const device = options.device || 'default';
            args.push('-i', device);
        }

        const codec = options.codec || 'libmp3lame';
        args.push('-acodec', codec);
        args.push('-b:a', options.bitrate || '64k');
        args.push('-ar', String(options.sampleRate || 44100));
        args.push('-ac', String(options.channels || 1));

        args.push('-y');
        args.push(options.outputPath);

        return args;
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.cancelRecording();
        this.onStateChangeEmitter.dispose();
    }
}
