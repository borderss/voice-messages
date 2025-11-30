import * as vscode from 'vscode';
import { StorageManager } from '../storage/storageManager';

// Marker pattern: // 🎤 voice:uuid or /* 🎤 voice:uuid */
const VOICE_MARKER_PATTERN = /(?:\/\/|\/\*|#|<!--|--)\s*🎤\s*voice:([a-f0-9-]+)/gi;

/**
 * Decoration type for hiding the UUID portion
 */
const uuidHideDecorationType = vscode.window.createTextEditorDecorationType({
    textDecoration: 'none',
    letterSpacing: '-1000px',
    opacity: '0',
});

/**
 * Decoration type for showing the title badge after the marker
 */
const titleBadgeDecorationType = vscode.window.createTextEditorDecorationType({});

/**
 * CodeLens provider that shows play buttons for voice message markers
 */
export class VoiceMessageCodeLensProvider implements vscode.CodeLensProvider {
    private readonly onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses = this.onDidChangeCodeLensesEmitter.event;

    constructor(private readonly storageManager: StorageManager) {
        storageManager.onMessagesChanged(() => {
            this.onDidChangeCodeLensesEmitter.fire();
            this.updateAllDecorations();
        });

        vscode.window.onDidChangeActiveTextEditor(() => {
            this.updateAllDecorations();
        });

        vscode.workspace.onDidChangeTextDocument((e) => {
            const editor = vscode.window.activeTextEditor;
            if (editor && e.document === editor.document) {
                this.updateDecorations(editor);
            }
        });

        if (vscode.window.activeTextEditor) {
            this.updateDecorations(vscode.window.activeTextEditor);
        }
    }

    /**
     * Update decorations for all visible editors
     */
    private updateAllDecorations(): void {
        for (const editor of vscode.window.visibleTextEditors) {
            this.updateDecorations(editor);
        }
    }

    /**
     * Update decorations for a specific editor
     */
    private updateDecorations(editor: vscode.TextEditor): void {
        const document = editor.document;
        const text = document.getText();
        
        const hideDecorations: vscode.DecorationOptions[] = [];
        const titleDecorations: vscode.DecorationOptions[] = [];
        
        let match: RegExpExecArray | null;
        VOICE_MARKER_PATTERN.lastIndex = 0;

        while ((match = VOICE_MARKER_PATTERN.exec(text)) !== null) {
            const messageId = match[1];
            const message = this.storageManager.getMessage(messageId);
            
            const voicePrefixIndex = match.index + match[0].indexOf('voice:');
            const uuidEndIndex = voicePrefixIndex + 'voice:'.length + messageId.length;
            
            const hideStart = document.positionAt(voicePrefixIndex);
            const hideEnd = document.positionAt(uuidEndIndex);
            
            hideDecorations.push({
                range: new vscode.Range(hideStart, hideEnd),
            });

            let displayTitle: string;
            if (message?.label) {
                displayTitle = message.label;
            } else if (message?.createdAt) {
                const date = new Date(message.createdAt);
                displayTitle = `Voice message, ${date.toLocaleString()}`;
            } else {
                displayTitle = 'Voice message';
            }
            
            titleDecorations.push({
                range: new vscode.Range(hideStart, hideStart),
                renderOptions: {
                    before: {
                        contentText: displayTitle,
                        color: new vscode.ThemeColor('charts.purple'),
                        fontStyle: 'italic',
                        fontWeight: 'normal',
                    }
                }
            });
        }

        editor.setDecorations(uuidHideDecorationType, hideDecorations);
        editor.setDecorations(titleBadgeDecorationType, titleDecorations);
    }

    public provideCodeLenses(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.CodeLens[] {
        const codeLenses: vscode.CodeLens[] = [];
        const text = document.getText();

        let match: RegExpExecArray | null;
        VOICE_MARKER_PATTERN.lastIndex = 0;

        while ((match = VOICE_MARKER_PATTERN.exec(text)) !== null) {
            const messageId = match[1];
            const position = document.positionAt(match.index);
            const range = new vscode.Range(position, position);

            const message = this.storageManager.getMessage(messageId);

            if (message) {
                codeLenses.push(new vscode.CodeLens(range, {
                    title: '▶️ Load Voice Message',
                    command: 'voice-messages.loadMessage',
                    arguments: [messageId],
                    tooltip: `Recorded: ${new Date(message.createdAt).toLocaleString()}${message.duration ? ` (${Math.round(message.duration)}s)` : ''}`
                }));

                codeLenses.push(new vscode.CodeLens(range, {
                    title: '🗑️ Delete',
                    command: 'voice-messages.deleteMessage',
                    arguments: [messageId],
                    tooltip: 'Delete this voice message'
                }));
            } else {
                codeLenses.push(new vscode.CodeLens(range, {
                    title: '⚠️ Voice message not found',
                    command: 'voice-messages.cleanupOrphanedMarker',
                    arguments: [messageId, document.uri, position.line],
                    tooltip: 'This voice message marker has no associated audio file'
                }));
            }
        }

        return codeLenses;
    }

    /**
     * Refresh CodeLenses for all documents
     */
    public refresh(): void {
        this.onDidChangeCodeLensesEmitter.fire();
    }

    public dispose(): void {
        this.onDidChangeCodeLensesEmitter.dispose();
    }
}

/**
 * Generate a voice message marker comment for insertion into code.
 * Uses a comprehensive mapping of language IDs to comment styles.
 */
export function generateMarkerComment(messageId: string, languageId: string): string {
    const commentPatterns: Record<string, { line?: string; block?: [string, string] }> = {
        'javascript': { line: '//' },
        'typescript': { line: '//' },
        'javascriptreact': { line: '//' },
        'typescriptreact': { line: '//' },
        'c': { line: '//' },
        'cpp': { line: '//' },
        'csharp': { line: '//' },
        'java': { line: '//' },
        'go': { line: '//' },
        'rust': { line: '//' },
        'swift': { line: '//' },
        'kotlin': { line: '//' },
        'php': { line: '//' },
        'scala': { line: '//' },
        'dart': { line: '//' },
        'groovy': { line: '//' },
        'jsonc': { line: '//' },
        'objective-c': { line: '//' },
        'objective-cpp': { line: '//' },
        'fsharp': { line: '//' },
        'd': { line: '//' },
        'haxe': { line: '//' },
        'actionscript': { line: '//' },
        'processing': { line: '//' },
        'solidity': { line: '//' },
        'v': { line: '//' },
        'zig': { line: '//' },
        'odin': { line: '//' },

        'python': { line: '#' },
        'ruby': { line: '#' },
        'perl': { line: '#' },
        'perl6': { line: '#' },
        'raku': { line: '#' },
        'shellscript': { line: '#' },
        'bash': { line: '#' },
        'sh': { line: '#' },
        'zsh': { line: '#' },
        'fish': { line: '#' },
        'powershell': { line: '#' },
        'yaml': { line: '#' },
        'toml': { line: '#' },
        'dockerfile': { line: '#' },
        'makefile': { line: '#' },
        'cmake': { line: '#' },
        'r': { line: '#' },
        'julia': { line: '#' },
        'nim': { line: '#' },
        'crystal': { line: '#' },
        'elixir': { line: '#' },
        'coffeescript': { line: '#' },
        'tcl': { line: '#' },
        'awk': { line: '#' },
        'sed': { line: '#' },
        'conf': { line: '#' },
        'properties': { line: '#' },
        'gitignore': { line: '#' },
        'ignore': { line: '#' },
        'ini': { line: ';' },
        'editorconfig': { line: '#' },

        'sql': { line: '--' },
        'plsql': { line: '--' },
        'hive-sql': { line: '--' },
        'lua': { line: '--' },
        'haskell': { line: '--' },
        'elm': { line: '--' },
        'purescript': { line: '--' },
        'ada': { line: '--' },
        'vhdl': { line: '--' },
        'applescript': { line: '--' },

        'latex': { line: '%' },
        'tex': { line: '%' },
        'bibtex': { line: '%' },
        'matlab': { line: '%' },
        'octave': { line: '%' },
        'erlang': { line: '%' },
        'prolog': { line: '%' },
        'postscript': { line: '%' },

        'lisp': { line: ';' },
        'clojure': { line: ';' },
        'scheme': { line: ';' },
        'racket': { line: ';' },
        'commonlisp': { line: ';' },
        'emacs-lisp': { line: ';' },
        'asm': { line: ';' },
        'nasm': { line: ';' },
        'masm': { line: ';' },

        'vb': { line: "'" },
        'vba': { line: "'" },
        'vbscript': { line: "'" },

        'html': { block: ['<!--', '-->'] },
        'xml': { block: ['<!--', '-->'] },
        'xsl': { block: ['<!--', '-->'] },
        'xslt': { block: ['<!--', '-->'] },
        'svg': { block: ['<!--', '-->'] },
        'vue': { block: ['<!--', '-->'] },
        'svelte': { block: ['<!--', '-->'] },
        'astro': { block: ['<!--', '-->'] },
        'markdown': { block: ['<!--', '-->'] },
        'mdx': { block: ['<!--', '-->'] },

        'css': { block: ['/*', '*/'] },
        'scss': { line: '//' },
        'sass': { line: '//' },
        'less': { line: '//' },
        'stylus': { line: '//' },

        'forth': { line: '\\' },
        'cobol': { line: '*>' },
        'fortran': { line: '!' },
        'abap': { line: '"' },
    };

    const pattern = commentPatterns[languageId];

    if (pattern?.line) {
        return `${pattern.line} 🎤 voice:${messageId}`;
    } else if (pattern?.block) {
        return `${pattern.block[0]} 🎤 voice:${messageId} ${pattern.block[1]}`;
    }

    return `// 🎤 voice:${messageId}`;
}
