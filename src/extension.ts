import * as vscode from 'vscode';
import { FFmpegRecorder } from './recorder/ffmpegRecorder';
import { StorageManager } from './storage/storageManager';
import { VoiceMessageCodeLensProvider, generateMarkerComment } from './codelens/voiceMessageCodeLens';
import { AudioPlayer } from './player/audioPlayer';
import { VoiceMessage, RecordingState } from './types';

let recorder: FFmpegRecorder;
let storageManager: StorageManager;
let codeLensProvider: VoiceMessageCodeLensProvider;
let audioPlayer: AudioPlayer;
let statusBarItem: vscode.StatusBarItem;
let pendingRecording: { documentUri: string; line: number; title?: string } | null = null;

export async function activate(context: vscode.ExtensionContext) {
    recorder = new FFmpegRecorder();
    storageManager = new StorageManager(context);
    await storageManager.initialize();

    codeLensProvider = new VoiceMessageCodeLensProvider(storageManager);
    audioPlayer = new AudioPlayer(context, storageManager);

    const audioPlayerViewDisposable = vscode.window.registerWebviewViewProvider(
        AudioPlayer.viewType,
        audioPlayer
    );

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'voice-messages.toggleRecording';
    updateStatusBar('idle');
    statusBarItem.show();

    recorder.onStateChange((state: RecordingState) => {
        updateStatusBar(state);
    });

    const codeLensDisposable = vscode.languages.registerCodeLensProvider(
        { scheme: 'file' },
        codeLensProvider
    );

    const commands = [
        vscode.commands.registerCommand('voice-messages.startRecording', startRecording),
        vscode.commands.registerCommand('voice-messages.stopRecording', stopRecording),
        vscode.commands.registerCommand('voice-messages.cancelRecording', cancelRecording),
        vscode.commands.registerCommand('voice-messages.toggleRecording', toggleRecording),
        vscode.commands.registerCommand('voice-messages.loadMessage', playMessage),
        vscode.commands.registerCommand('voice-messages.deleteMessage', deleteMessage),
        vscode.commands.registerCommand('voice-messages.selectAudioDevice', selectAudioDevice),
        vscode.commands.registerCommand('voice-messages.cleanupOrphanedMarker', cleanupOrphanedMarker),
        vscode.commands.registerCommand('voice-messages.cleanupOrphanedAudioFiles', cleanupOrphanedAudioFiles),
    ];

    context.subscriptions.push(
        codeLensDisposable,
        audioPlayerViewDisposable,
        statusBarItem,
        recorder,
        storageManager,
        codeLensProvider,
        audioPlayer,
        ...commands
    );
}

function updateStatusBar(state: RecordingState): void {
    switch (state) {
        case 'idle':
            statusBarItem.text = '$(mic) Voice';
            statusBarItem.tooltip = 'Click to start recording a voice message';
            statusBarItem.backgroundColor = undefined;
            break;
        case 'recording':
            statusBarItem.text = '$(primitive-square) Recording...';
            statusBarItem.tooltip = 'Click to stop recording';
            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            break;
        case 'stopping':
            statusBarItem.text = '$(sync~spin) Saving...';
            statusBarItem.tooltip = 'Saving recording...';
            statusBarItem.backgroundColor = undefined;
            break;
    }
}

async function startRecording(): Promise<void> {
    if (!storageManager.isAvailable()) {
        vscode.window.showWarningMessage('Please open a folder or workspace to use voice messages.');
        return;
    }

    const isAvailable = await FFmpegRecorder.isAvailable();
    if (!isAvailable) {
        await FFmpegRecorder.promptInstallation();
        return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('Please open a file and place your cursor where you want to attach the voice message.');
        return;
    }

    const title = await vscode.window.showInputBox({
        prompt: 'Enter a title for this voice message (optional)',
        placeHolder: 'Press Enter to skip',
        title: 'Voice Message Title'
    });

    if (title === undefined) {
        return;
    }

    pendingRecording = {
        documentUri: editor.document.uri.toString(),
        line: editor.selection.active.line,
        title: title || undefined
    };

    const device = await recorder.getPreferredDevice();
    const messageId = storageManager.generateId();
    const outputPath = storageManager.getAudioFilePath(messageId);

    try {
        await recorder.startRecording({
            outputPath,
            device
        });

        vscode.window.showInformationMessage('🎤 Recording started. Click the status bar or run "Stop Recording" when done.');
    } catch (error) {
        pendingRecording = null;
        if (error instanceof Error && error.message !== 'FFMPEG is not installed') {
            vscode.window.showErrorMessage(`Failed to start recording: ${error.message}`);
        }
    }
}

async function stopRecording(): Promise<void> {
    if (recorder.getState() !== 'recording') {
        vscode.window.showWarningMessage('No recording in progress.');
        return;
    }

    if (!pendingRecording) {
        vscode.window.showErrorMessage('Recording location was lost. Canceling recording.');
        await cancelRecording();
        return;
    }

    try {
        const { path: audioPath, duration } = await recorder.stopRecording();

        const messageIdMatch = /([a-f0-9-]+)\.mp3$/i.exec(audioPath);
        const messageId = messageIdMatch?.[1];
        if (!messageId) {
            throw new Error('Failed to extract message ID from path');
        }

        const message: VoiceMessage = {
            id: messageId,
            audioFileName: `${messageId}.mp3`,
            documentUri: pendingRecording.documentUri,
            line: pendingRecording.line,
            createdAt: new Date().toISOString(),
            duration,
            label: pendingRecording.title
        };

        await storageManager.saveMessage(message);
        await insertMarkerComment(message);

        const titleDisplay = pendingRecording.title ? ` "${pendingRecording.title}"` : '';
        vscode.window.showInformationMessage(`🎤 Voice message${titleDisplay} saved (${Math.round(duration)}s)`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to save recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
        pendingRecording = null;
    }
}

async function cancelRecording(): Promise<void> {
    await recorder.cancelRecording();
    pendingRecording = null;
    vscode.window.showInformationMessage('Recording canceled.');
}

async function toggleRecording(): Promise<void> {
    if (recorder.getState() === 'recording') {
        await stopRecording();
    } else {
        await startRecording();
    }
}

async function playMessage(messageId: string): Promise<void> {
    await audioPlayer.play(messageId);
}

async function deleteMessage(messageId: string): Promise<void> {
    const message = storageManager.getMessage(messageId);
    if (!message) {
        vscode.window.showErrorMessage('Voice message not found.');
        return;
    }

    const confirm = await vscode.window.showWarningMessage(
        'Are you sure you want to delete this voice message?',
        { modal: true },
        'Delete'
    );

    if (confirm !== 'Delete') {
        return;
    }

    await storageManager.deleteMessage(messageId);
    await removeMarkerComment(message.documentUri, messageId);
    audioPlayer.close();

    vscode.window.showInformationMessage('Voice message deleted.');
}

async function selectAudioDevice(): Promise<void> {
    const isAvailable = await FFmpegRecorder.isAvailable();
    if (!isAvailable) {
        await FFmpegRecorder.promptInstallation();
        return;
    }

    const devices = await recorder.listDevices();

    if (devices.length === 0) {
        vscode.window.showWarningMessage('No audio input devices found.');
        return;
    }

    const items: vscode.QuickPickItem[] = [
        {
            label: '$(sync) Auto-detect',
            description: 'Use system default audio device',
            detail: 'auto'
        },
        ...devices.map(device => ({
            label: device.isDefault ? `$(check) ${device.name}` : device.name,
            description: device.isDefault ? 'Default device' : undefined,
            detail: device.id
        }))
    ];

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select audio input device',
        title: 'Voice Messages: Audio Device'
    });

    if (selected) {
        const config = vscode.workspace.getConfiguration('voice-messages');
        await config.update('audioDevice', selected.detail, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Audio device set to: ${selected.label.replace('$(check) ', '').replace('$(sync) ', '')}`);
    }
}

async function cleanupOrphanedMarker(messageId: string, documentUri: vscode.Uri, line: number): Promise<void> {
    const remove = await vscode.window.showWarningMessage(
        'This voice message marker has no associated audio file. Remove it?',
        'Remove Marker',
        'Cancel'
    );

    if (remove === 'Remove Marker') {
        await removeMarkerComment(documentUri.toString(), messageId);
    }
}

async function cleanupOrphanedAudioFiles(): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
        'This will delete all audio files that are not referenced by any voice message marker. Continue?',
        { modal: true },
        'Delete Unreferenced Files'
    );

    if (confirm !== 'Delete Unreferenced Files') {
        return;
    }

    const deletedCount = await storageManager.cleanupOrphanedAudioFiles();
    
    if (deletedCount > 0) {
        vscode.window.showInformationMessage(`Deleted ${deletedCount} unreferenced audio file${deletedCount === 1 ? '' : 's'}.`);
    } else {
        vscode.window.showInformationMessage('No unreferenced audio files found.');
    }
}

async function insertMarkerComment(message: VoiceMessage): Promise<void> {
    const uri = vscode.Uri.parse(message.documentUri);
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);

    const line = message.line;
    const languageId = document.languageId;

    const marker = generateMarkerComment(message.id, languageId);

    await editor.edit((editBuilder: vscode.TextEditorEdit) => {
        const insertPosition = new vscode.Position(line, 0);
        editBuilder.insert(insertPosition, marker + '\n');
    });
}

async function removeMarkerComment(documentUri: string, messageId: string): Promise<void> {
    try {
        const uri = vscode.Uri.parse(documentUri);
        const document = await vscode.workspace.openTextDocument(uri);

        const text = document.getText();
        const pattern = new RegExp(`^.*🎤\\s*voice:${messageId}.*$`, 'gm');
        const match = pattern.exec(text);

        if (match) {
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + match[0].length + 1);

            const editor = await vscode.window.showTextDocument(document);
            await editor.edit((editBuilder: vscode.TextEditorEdit) => {
                editBuilder.delete(new vscode.Range(startPos, endPos));
            });
        }
    } catch {
    }
}

export function deactivate() {}
