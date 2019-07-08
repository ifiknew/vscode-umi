import * as vscode from 'vscode'
import Registry from '../utils/Registry'
import LanguageService from '../services/LanguageService'

@Registry.naming
export default class DefinitionProvider implements vscode.DefinitionProvider {

  @Registry.inject
	private languageService!: LanguageService;

  provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
    return this.languageService.provideDefinition(document, position, token)
  }
}