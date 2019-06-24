import * as vscode from 'vscode'
import * as ts from 'typescript'
import Registry from '../utils/Registry';
import CompilerHostService from '../services/CompilerHostService';
import createSourceFile from '../utils/typescript/createSourceFile';
import traverse, { TraverseAction } from '../utils/typescript/traverse';

/**
 * to generate diagnostics when doc changeed
 */
@Registry.naming
export default class DiagnosticPlugin {

  @Registry.inject
  private compilerHostService!: CompilerHostService

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
        const args = node.arguments
        if (args.length !== 1) {
          diagnostics.push(DiagnosticPlugin.createDiagnostic(
            file, 
            node.pos, 
            node.end, 
            args.length >= 2 ? 'dispatch call has only one argument' : 'Please complete dispatch call'
          ))
        } else {
          const actionNode = args[0]
          if (!ts.isObjectLiteralExpression(actionNode)) {
            diagnostics.push(DiagnosticPlugin.createDiagnostic(
              file, 
              node.pos, 
              node.end, 
              'type not match { type: string, payload: object }'
            ))
          } else {
            actionNode
          }
        }
        return TraverseAction.BlockChildren
      }
    })
    this.diagnosticCollection.set(document.uri, diagnostics)
  }

  private static createDiagnostic(file: ts.SourceFile, pos: number, end: number, message: string, severity?: vscode.DiagnosticSeverity) {
    
    const startPos = file.getLineAndCharacterOfPosition(pos)
    const endPos = file.getLineAndCharacterOfPosition(end)

    return new vscode.Diagnostic(
      new vscode.Range(new vscode.Position(startPos.line, startPos.character), new vscode.Position(endPos.line, endPos.character)),
      message,
      severity
    )
  }
}