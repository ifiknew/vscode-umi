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

		return this.languageService.provideCompletionItems(document, position, token, context)
		
	}
	
}