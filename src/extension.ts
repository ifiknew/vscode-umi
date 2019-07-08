import 'core-js/features/array/flat';
import 'reflect-metadata'

import * as vscode from 'vscode';

import Registry from './utils/Registry';
import DiagnosticPlugin from './plugins/DiagnosticPlugin';
import CompletionItemProvider from './providers/CompletionItemProvider';
import DefinitionProvider from './providers/DefinitionProvider';
import SignatureHelpProvider from './providers/SignatureHelpProvider';

export async function activate(context: vscode.ExtensionContext) {

	const selectors = [
		{ scheme: 'file', language: 'typescript' }, 
		{ scheme: 'file', language: 'typescriptreact' }
	]
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(
			selectors, 
			Registry.lookup(CompletionItemProvider)
		),
		vscode.languages.registerDefinitionProvider(
			selectors,
			Registry.lookup(DefinitionProvider)
		),
		vscode.languages.registerSignatureHelpProvider(
			selectors,
			Registry.lookup(SignatureHelpProvider),
			{
				triggerCharacters: ['(', ')', ',', 't', 'p'],
				retriggerCharacters: []
			}
		),
		Registry.lookup(DiagnosticPlugin)
	);
	

	console.log('Congratulations, your extension is now active!');
}
export function deactivate() {}
