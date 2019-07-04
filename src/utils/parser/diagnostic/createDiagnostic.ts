import * as ts from 'typescript'
import * as vscode from 'vscode'

export function createDiagnosticForFile(file: ts.SourceFile, pos: number, end: number, message: string, severity?: vscode.DiagnosticSeverity) {

  const startPos = file.getLineAndCharacterOfPosition(pos)
  const endPos = file.getLineAndCharacterOfPosition(end)

  return new vscode.Diagnostic(
    new vscode.Range(new vscode.Position(startPos.line, startPos.character), new vscode.Position(endPos.line, endPos.character)),
    `[vscode-umi] ${message}`,
    severity
  )
}

function createDiagnostic(node: ts.Node, message: string, severity?: vscode.DiagnosticSeverity) {
  return createDiagnosticForFile(node.getSourceFile(), node.pos, node.end, message, severity)
}

export default createDiagnostic