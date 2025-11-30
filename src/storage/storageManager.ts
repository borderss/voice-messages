import * as vscode from 'vscode';
import { VoiceMessage } from '../types';

const VOICE_MESSAGES_FOLDER = '.voice-messages';
const INDEX_FILE = 'index.json';
const AUDIO_FOLDER = 'audio';

/**
 * Manages storage of voice messages and their metadata
 * Stores voice messages in .voice-messages/ folder in the workspace root
 */
export class StorageManager {
    private storageUri: vscode.Uri | undefined;
    private audioFolderUri: vscode.Uri | undefined;
    private indexUri: vscode.Uri | undefined;
    private messages: Map<string, VoiceMessage> = new Map();
    private initialized = false;

    private readonly onMessagesChangedEmitter = new vscode.EventEmitter<void>();
    public readonly onMessagesChanged = this.onMessagesChangedEmitter.event;

    constructor(private readonly context: vscode.ExtensionContext) {}

    /**
     * Get the workspace folder URI for storage
     */
    private getWorkspaceStorageUri(): vscode.Uri | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return undefined;
        }
        // Use the first workspace folder
        return vscode.Uri.joinPath(workspaceFolders[0].uri, VOICE_MESSAGES_FOLDER);
    }

    /**
     * Initialize storage - create directories and load existing messages
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        this.storageUri = this.getWorkspaceStorageUri();
        
        if (!this.storageUri) {
            this.initialized = true;
            return;
        }

        this.audioFolderUri = vscode.Uri.joinPath(this.storageUri, AUDIO_FOLDER);
        this.indexUri = vscode.Uri.joinPath(this.storageUri, INDEX_FILE);

        try {
            await vscode.workspace.fs.createDirectory(this.storageUri);
            await vscode.workspace.fs.createDirectory(this.audioFolderUri);
            await this.loadIndex();
            this.initialized = true;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Check if storage is available (workspace is open)
     */
    public isAvailable(): boolean {
        return this.storageUri !== undefined;
    }

    /**
     * Get the path for a new audio file
     */
    public getAudioFilePath(id: string): string {
        if (!this.audioFolderUri) {
            throw new Error('No workspace open. Cannot create audio file.');
        }
        const audioFileUri = vscode.Uri.joinPath(this.audioFolderUri, `${id}.mp3`);
        return audioFileUri.fsPath;
    }

    /**
     * Save a new voice message
     */
    public async saveMessage(message: VoiceMessage): Promise<void> {
        this.messages.set(message.id, message);
        await this.saveIndex();
        this.onMessagesChangedEmitter.fire();
    }

    /**
     * Get a voice message by ID
     */
    public getMessage(id: string): VoiceMessage | undefined {
        return this.messages.get(id);
    }

    /**
     * Get all voice messages
     */
    public getAllMessages(): VoiceMessage[] {
        return Array.from(this.messages.values());
    }

    /**
     * Get messages for a specific document
     */
    public getMessagesForDocument(documentUri: string): VoiceMessage[] {
        return this.getAllMessages().filter(m => m.documentUri === documentUri);
    }

    /**
     * Get messages for a specific line in a document
     */
    public getMessageForLine(documentUri: string, line: number): VoiceMessage | undefined {
        return this.getAllMessages().find(m => m.documentUri === documentUri && m.line === line);
    }

    /**
     * Update an existing voice message
     */
    public async updateMessage(id: string, updates: Partial<VoiceMessage>): Promise<void> {
        const existing = this.messages.get(id);
        if (!existing) {
            throw new Error(`Message not found: ${id}`);
        }

        const updated = { ...existing, ...updates };
        this.messages.set(id, updated);
        await this.saveIndex();
        this.onMessagesChangedEmitter.fire();
    }

    /**
     * Delete a voice message and its audio file
     */
    public async deleteMessage(id: string): Promise<void> {
        const message = this.messages.get(id);
        if (!message) {
            return;
        }

        try {
            if (this.audioFolderUri) {
                const audioUri = vscode.Uri.joinPath(this.audioFolderUri, message.audioFileName);
                await vscode.workspace.fs.delete(audioUri);
            }
        } catch {
        }

        this.messages.delete(id);
        await this.saveIndex();
        this.onMessagesChangedEmitter.fire();
    }

    /**
     * Get the full URI for an audio file
     */
    public getAudioFileUri(message: VoiceMessage): vscode.Uri {
        if (!this.audioFolderUri) {
            throw new Error('No workspace open. Cannot get audio file URI.');
        }
        return vscode.Uri.joinPath(this.audioFolderUri, message.audioFileName);
    }

    /**
     * Check if an audio file exists
     */
    public async audioFileExists(message: VoiceMessage): Promise<boolean> {
        try {
            const uri = this.getAudioFileUri(message);
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Update line numbers when document changes
     */
    public async updateLineNumbers(documentUri: string, lineChanges: Map<number, number>): Promise<void> {
        let changed = false;

        for (const [id, message] of this.messages) {
            if (message.documentUri === documentUri) {
                const newLine = lineChanges.get(message.line);
                if (newLine !== undefined && newLine !== message.line) {
                    message.line = newLine;
                    changed = true;
                }
            }
        }

        if (changed) {
            await this.saveIndex();
            this.onMessagesChangedEmitter.fire();
        }
    }

    private async loadIndex(): Promise<void> {
        if (!this.indexUri) {
            return;
        }
        try {
            const data = await vscode.workspace.fs.readFile(this.indexUri);
            const json = new TextDecoder().decode(data);
            const messages: VoiceMessage[] = JSON.parse(json);

            this.messages.clear();
            for (const message of messages) {
                this.messages.set(message.id, message);
            }
        } catch {
            this.messages.clear();
        }
    }

    private async saveIndex(): Promise<void> {
        if (!this.indexUri) {
            return;
        }
        const messages = Array.from(this.messages.values());
        const json = JSON.stringify(messages, null, 2);
        const data = new TextEncoder().encode(json);
        await vscode.workspace.fs.writeFile(this.indexUri, data);
    }

    /**
     * Generate a unique ID for a new message
     */
    public generateId(): string {
        return crypto.randomUUID();
    }

    /**
     * Find and delete audio files that are not referenced in the index
     * Returns the number of deleted files
     */
    public async cleanupOrphanedAudioFiles(): Promise<number> {
        if (!this.audioFolderUri) {
            return 0;
        }

        let deletedCount = 0;
        
        try {
            const entries = await vscode.workspace.fs.readDirectory(this.audioFolderUri);
            const referencedFiles = new Set(
                Array.from(this.messages.values()).map(m => m.audioFileName)
            );

            for (const [name, type] of entries) {
                if (type === vscode.FileType.File && name.endsWith('.mp3')) {
                    if (!referencedFiles.has(name)) {
                        const fileUri = vscode.Uri.joinPath(this.audioFolderUri, name);
                        await vscode.workspace.fs.delete(fileUri);
                        deletedCount++;
                    }
                }
            }
        } catch {
        }

        return deletedCount;
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.onMessagesChangedEmitter.dispose();
    }
}
