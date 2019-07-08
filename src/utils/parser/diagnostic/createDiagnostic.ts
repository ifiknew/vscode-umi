import * as ts from 'typescript'
import * as vscode from 'vscode'
import createRangeFromNode from '../createRangeFromNode';
import Config from '../../Config';

function createDiagnostic(node: ts.Node, message: string, severity?: vscode.DiagnosticSeverity) {

  const range = createRangeFromNode(node)

  return new vscode.Diagnostic(
    range,
    `${Config.LogLabel} ${message}`,
    severity
  )
}

export default createDiagnostic