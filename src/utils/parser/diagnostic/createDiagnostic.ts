import * as ts from 'typescript'
import * as vscode from 'vscode'
import createRangeFromNode from '../createRangeFromNode';

function createDiagnostic(node: ts.Node, message: string, severity?: vscode.DiagnosticSeverity) {

  const range = createRangeFromNode(node)

  return new vscode.Diagnostic(
    range,
    `[vscode-umi] ${message}`,
    severity
  )
}

export default createDiagnostic