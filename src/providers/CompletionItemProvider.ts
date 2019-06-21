import * as vscode from 'vscode'
import Registry from '../utils/Registry'
import LanguageService from '../services/LanguageService'

@Registry.naming
export default class CompletionItemProvider implements vscode.CompletionItemProvider {

  @Registry.inject
	private languageService!: LanguageService;

  provideCompletionItems(
    document: vscode.TextDocument, 
    position: vscode.Position, 
    token: vscode.CancellationToken, 
    context: vscode.CompletionContext
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
		
		// const snippetCompletion = new vscode.CompletionItem('dispatch');
		// snippetCompletion.insertText = new vscode.SnippetString("dispatch({\n  type: , \n  payload: \n})");
		// snippetCompletion.documentation = new vscode.MarkdownString("Inserts a snippet that lets you select the _appropriate_ part of the day for your greeting.");
		// snippetCompletion.detail = 'dispatch an action to redux';
		// snippetCompletion.preselect = true;

		// return [
		// 	snippetCompletion,
		// ];

		return this.languageService.provideCompletionItems(document, position, token, context)
	}
	
}