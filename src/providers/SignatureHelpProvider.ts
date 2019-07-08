import * as vscode from 'vscode'
import Registry from '../utils/Registry'
import LanguageService from '../services/LanguageService'

@Registry.naming
export default class SignatureHelpProvider implements vscode.SignatureHelpProvider {

  @Registry.inject
	private languageService!: LanguageService;

  provideSignatureHelp(
    document: vscode.TextDocument, 
    position: vscode.Position, 
    token: vscode.CancellationToken, 
    context: vscode.SignatureHelpContext
  ): vscode.ProviderResult<vscode.SignatureHelp> {
    return this.languageService.provideSignatureHelp(document, position, token, context)
  }
}