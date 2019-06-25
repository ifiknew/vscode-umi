import * as vscode from 'vscode'
import * as ts from 'typescript'
import Registry from '../utils/Registry';
import createSourceFile from '../utils/parser/createSourceFile';
import traverse, { TraverseAction } from '../utils/parser/traverse';
import getDispatchCallDiagnostics from '../utils/parser/diagnostic/getDispatchCallDiagnostics';
import ModelService from '../services/ModelService';
import CompilerHostService from '../services/CompilerHostService';

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
  
  constructor() { 
    vscode.workspace.onDidOpenTextDocument(doc => {
      this.provideDiagnostics(doc)
    })
    vscode.workspace.onDidChangeTextDocument(e => {
      this.provideDiagnostics(e.document)
    })
  }

  private provideDiagnostics(document: vscode.TextDocument) {
    this.diagnosticCollection.clear()
    const diagnostics: vscode.Diagnostic[] = []
    const file = createSourceFile(document.getText())
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
}