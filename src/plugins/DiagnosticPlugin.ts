import * as vscode from 'vscode'
import * as ts from 'typescript'
import Registry from '../utils/Registry';
import traverse, { TraverseAction } from '../utils/parser/traverse';
import getDispatchCallDiagnostics from '../utils/parser/diagnostic/getDispatchCallDiagnostics';
import ModelService from '../services/ModelService';
import CompilerHostService from '../services/CompilerHostService';
import InMemoryFile from '../utils/InMemoryFile';

/**
 * to generate diagnostics when doc changeed
 */
@Registry.naming
export default class DiagnosticPlugin {

  @Registry.inject
  private compilerHostService!: CompilerHostService

  @Registry.inject
  private modelService!: ModelService

  private diagnosticCollection: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection('umi')

  private disposables: vscode.Disposable[] = []
  
  constructor() {
    /**
     * @todo listen to compilerhost file change and judge whether to provide diagnostics
     */
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument(doc => {
        this.provideDiagnostics(doc)
      }),
      vscode.workspace.onDidChangeTextDocument(e => {
        this.provideDiagnostics(e.document)
      }),
    )
  }

  private provideDiagnostics(document: vscode.TextDocument) {
    this.diagnosticCollection.clear()
    const diagnostics: vscode.Diagnostic[] = []
    const fileName = document.fileName.replace(/(\.[^.]*)$/, `${InMemoryFile.middleExt}$1`)
    this.compilerHostService.updateInMemoryFile(fileName, document.getText())
    const file = this.compilerHostService.getProgram().getSourceFile(fileName)
    if (!file) { return }
    // check dispatch call
    traverse(file, node => {
      if (
        ts.isCallExpression(node)
        && node.getChildAt(0).getLastToken()!.getText() === 'dispatch'
      ) {
        diagnostics.push(...getDispatchCallDiagnostics(
          node, 
          this.modelService.getActions(), 
          { checker: this.compilerHostService.getProgram().getTypeChecker() }
        ))
        return TraverseAction.BlockChildren
      }
    })
    this.diagnosticCollection.set(document.uri, diagnostics)
  }

  public dispose() {
    this.disposables.forEach(v => v.dispose())
  }
}