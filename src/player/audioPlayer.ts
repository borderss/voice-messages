import * as vscode from 'vscode';
import { StorageManager } from '../storage/storageManager';
import { VoiceMessage } from '../types';

/**
 * Audio player using a webview view in the panel area (bottom)
 */
export class AudioPlayer implements vscode.WebviewViewProvider {
    public static readonly viewType = 'voiceMessagesPlayer';
    
    private view: vscode.WebviewView | undefined;
    private currentMessage: VoiceMessage | undefined;
    private currentAudioUri: vscode.Uri | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly storageManager: StorageManager
    ) {}

    /**
     * Resolve the webview view when VS Code shows it
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: this.getLocalResourceRoots()
        };

        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible && this.currentMessage && this.currentAudioUri) {
                this.updatePlayerContent();
            }
        });

        webviewView.webview.onDidReceiveMessage((message) => {
            if (message.command === 'close') {
                this.close();
            } else if (message.command === 'ready') {
                this.view?.webview.postMessage({ command: 'play' });
            }
        });

        if (this.currentMessage && this.currentAudioUri) {
            this.updatePlayerContent();
        } else {
            webviewView.webview.html = this.getEmptyStateHtml();
        }
    }
    private getLocalResourceRoots(): vscode.Uri[] {
        const roots: vscode.Uri[] = [];
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            roots.push(workspaceFolders[0].uri);
            roots.push(vscode.Uri.joinPath(workspaceFolders[0].uri, '.voice-messages'));
            roots.push(vscode.Uri.joinPath(workspaceFolders[0].uri, '.voice-messages', 'audio'));
        }
        if (this.context.globalStorageUri) {
            roots.push(this.context.globalStorageUri);
        }
        return roots;
    }

    /**
     * Play a voice message by ID
     */
    public async play(messageId: string): Promise<void> {
        const message = this.storageManager.getMessage(messageId);
        if (!message) {
            vscode.window.showErrorMessage(`Voice message not found: ${messageId}`);
            return;
        }

        const exists = await this.storageManager.audioFileExists(message);
        if (!exists) {
            vscode.window.showErrorMessage('Audio file not found. The recording may have been deleted.');
            return;
        }

        this.currentMessage = message;
        this.currentAudioUri = this.storageManager.getAudioFileUri(message);

        await vscode.commands.executeCommand('voiceMessagesPlayer.focus');
        await new Promise(resolve => setTimeout(resolve, 50));
        this.updatePlayerContent();
    }

    private updatePlayerContent(): void {
        if (!this.view || !this.currentMessage || !this.currentAudioUri) {
            return;
        }

        const webviewAudioUri = this.view.webview.asWebviewUri(this.currentAudioUri);
        this.view.webview.html = this.getPlayerHtml(webviewAudioUri, this.currentMessage);
    }

    private getEmptyStateHtml(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: var(--vscode-font-family, system-ui, sans-serif);
            background-color: var(--vscode-sideBar-background, #1e1e1e);
            color: var(--vscode-sideBar-foreground, #cccccc);
            padding: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            text-align: center;
        }
        .empty {
            opacity: 0.7;
            font-size: 12px;
            color: var(--vscode-descriptionForeground, #969696);
        }
    </style>
</head>
<body>
    <div class="empty">
        🎤 Click a voice message to play
    </div>
</body>
</html>`;
    }

    private getPlayerHtml(audioUri: vscode.Uri, message: VoiceMessage): string {
        const dateStr = new Date(message.createdAt).toLocaleString();
        const durationStr = message.duration ? `${Math.round(message.duration)}s` : '';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: var(--vscode-font-family, system-ui, sans-serif);
            background-color: var(--vscode-sideBar-background, #1e1e1e);
            color: var(--vscode-sideBar-foreground, #cccccc);
            padding: 10px 12px;
        }
        .player {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .header {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .icon { font-size: 16px; }
        .title {
            font-size: 13px;
            font-weight: 600;
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            color: var(--vscode-foreground, #cccccc);
        }
        .close-btn {
            background: transparent;
            color: var(--vscode-descriptionForeground, #969696);
            border: none;
            width: 20px;
            height: 20px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
        }
        .close-btn:hover {
            background: var(--vscode-toolbar-hoverBackground, #5a5d5e50);
            color: var(--vscode-foreground, #cccccc);
        }
        .meta {
            font-size: 11px;
            color: var(--vscode-descriptionForeground, #969696);
        }
        .audio-container {
            background: var(--vscode-input-background, #3c3c3c);
            border-radius: 4px;
            padding: 8px;
        }
        audio {
            width: 100%;
            height: 32px;
            border-radius: 4px;
        }
        .custom-player {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .play-btn {
            background: var(--vscode-button-background, #0e639c);
            color: var(--vscode-button-foreground, #ffffff);
            border: none;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .play-btn:hover {
            background: var(--vscode-button-hoverBackground, #1177bb);
        }
        .play-btn:focus {
            outline: 2px solid var(--vscode-focusBorder, #007fd4);
            outline-offset: 2px;
        }
        .progress-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .progress-bar {
            width: 100%;
            height: 6px;
            background: var(--vscode-scrollbarSlider-background, #4d4d4d);
            border-radius: 3px;
            cursor: pointer;
            position: relative;
        }
        .progress-fill {
            height: 100%;
            background: var(--vscode-progressBar-background, #0e70c0);
            border-radius: 3px;
            width: 0%;
            transition: width 0.1s;
        }
        .time-display {
            font-size: 10px;
            color: var(--vscode-descriptionForeground, #969696);
            display: flex;
            justify-content: space-between;
        }
        .error {
            color: var(--vscode-errorForeground, #f48771);
            font-size: 11px;
            padding: 6px;
            background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
            border-radius: 4px;
            display: none;
        }
        .loading {
            color: var(--vscode-descriptionForeground, #969696);
            font-size: 11px;
            text-align: center;
            padding: 8px;
        }
    </style>
</head>
<body>
    <div class="player">
        <div class="header">
            <span class="icon">🎤</span>
            <span class="title">${this.escapeHtml(message.label || 'Voice message')}</span>
            <button class="close-btn" id="closeBtn" title="Close">✕</button>
        </div>
        <div class="audio-container">
            <div class="custom-player">
                <button class="play-btn" id="playBtn" title="Play/Pause (Space)" autofocus>▶</button>
                <div class="progress-container">
                    <div class="progress-bar" id="progressBar">
                        <div class="progress-fill" id="progressFill"></div>
                    </div>
                    <div class="time-display">
                        <span id="currentTime">0:00</span>
                        <span id="totalTime">--:--</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="meta">${dateStr}</div>
        <div id="loading" class="loading">Loading audio...</div>
        <div id="error" class="error"></div>
    </div>
    <audio id="audio" preload="auto"></audio>
    <script>
        const vscode = acquireVsCodeApi();
        const audio = document.getElementById('audio');
        const playBtn = document.getElementById('playBtn');
        const progressBar = document.getElementById('progressBar');
        const progressFill = document.getElementById('progressFill');
        const currentTimeEl = document.getElementById('currentTime');
        const totalTimeEl = document.getElementById('totalTime');
        const errorDiv = document.getElementById('error');
        const loadingDiv = document.getElementById('loading');
        const recordedDuration = ${message.duration || 0};
        const audioSrc = "${audioUri}";
        
        let isReady = false;

        function formatTime(seconds) {
            if (isNaN(seconds) || !isFinite(seconds)) return '--:--';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return mins + ':' + secs.toString().padStart(2, '0');
        }

        function startPlayback() {
            loadingDiv.style.display = 'none';
            audio.play().catch(() => {});
        }

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'play') {
                startPlayback();
            }
        });

        if (recordedDuration > 0) {
            totalTimeEl.textContent = formatTime(recordedDuration);
        }

        audio.addEventListener('loadedmetadata', () => {
            if (audio.duration && isFinite(audio.duration)) {
                totalTimeEl.textContent = formatTime(audio.duration);
            }
        });

        audio.addEventListener('canplay', () => {
            loadingDiv.style.display = 'none';
            if (!isReady) {
                isReady = true;
                vscode.postMessage({ command: 'ready' });
            }
        });

        audio.addEventListener('timeupdate', () => {
            const duration = audio.duration || recordedDuration;
            if (duration > 0) {
                const progress = (audio.currentTime / duration) * 100;
                progressFill.style.width = progress + '%';
            }
            currentTimeEl.textContent = formatTime(audio.currentTime);
        });

        audio.addEventListener('play', () => {
            playBtn.textContent = '⏸';
        });

        audio.addEventListener('pause', () => {
            playBtn.textContent = '▶';
        });

        audio.addEventListener('ended', () => {
            playBtn.textContent = '▶';
            progressFill.style.width = '0%';
            currentTimeEl.textContent = '0:00';
        });

        audio.addEventListener('waiting', () => {});

        audio.addEventListener('stalled', () => {
            loadingDiv.textContent = 'Audio stalled, retrying...';
        });

        audio.addEventListener('error', (e) => {
            loadingDiv.style.display = 'none';
            errorDiv.style.display = 'block';
            const errorCode = audio.error?.code;
            const errorMessages = {
                1: 'Aborted',
                2: 'Network error - file may not be accessible',
                3: 'Decode error - file may be corrupted',
                4: 'Source not supported - try a different codec'
            };
            errorDiv.textContent = 'Failed to load: ' + (errorMessages[errorCode] || 'Unknown error');
        });

        playBtn.addEventListener('click', () => {
            if (audio.paused) {
                audio.play().catch(e => {
                    errorDiv.style.display = 'block';
                    errorDiv.textContent = 'Failed to play: ' + e.message;
                });
            } else {
                audio.pause();
            }
        });

        progressBar.addEventListener('click', (e) => {
            const duration = audio.duration || recordedDuration;
            if (duration > 0) {
                const rect = progressBar.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                audio.currentTime = percent * duration;
            }
        });

        audio.src = audioSrc;
        audio.load();
        
        playBtn.focus();
        
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                if (audio.paused) {
                    audio.play().catch(() => {});
                } else {
                    audio.pause();
                }
            }
        });
        
        setTimeout(() => {
            if (audio.readyState === 0) {
                loadingDiv.style.display = 'none';
                errorDiv.style.display = 'block';
                errorDiv.textContent = 'Audio failed to load.';
            }
        }, 5000);

        document.getElementById('closeBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'close' });
        });
    </script>
</body>
</html>`;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * Close the player (clear current message)
     */
    public close(): void {
        this.currentMessage = undefined;
        this.currentAudioUri = undefined;
        if (this.view) {
            this.view.webview.html = this.getEmptyStateHtml();
        }
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.close();
    }
}
