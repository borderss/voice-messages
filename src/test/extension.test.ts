import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	test('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('undefined_publisher.voice-messages'));
	});

	test('Commands should be registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('voice-messages.startRecording'));
		assert.ok(commands.includes('voice-messages.stopRecording'));
		assert.ok(commands.includes('voice-messages.toggleRecording'));
	});
});
