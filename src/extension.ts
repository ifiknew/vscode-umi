import * as vscode from 'vscode';
import 'reflect-metadata'
import CompletionItemProvider from './providers/CompletionItemProvider';

const typeScriptExtensionId = 'vscode.typescript-language-features';

export async function activate(context: vscode.ExtensionContext) {
	const extension = vscode.extensions.getExtension(typeScriptExtensionId);
	if (!extension) {
		vscode.window.showErrorMessage('You have no ' + typeScriptExtensionId + ' extension')
		return
	}
	await extension.activate();

	const selectors = [
		{ scheme: 'file', language: 'typescript' }, 
		{ scheme: 'file', language: 'typescriptreact' }
	]
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(
			selectors, 
			new CompletionItemProvider()
		),
	);
	console.log('Congratulations, your extension is now active!');
}
export function deactivate() {}