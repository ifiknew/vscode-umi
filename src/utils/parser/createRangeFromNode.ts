import * as ts from 'typescript'
import * as vscode from 'vscode'

function createRangeFromNode(node: ts.Node) {

  const file = node.getSourceFile()

  const startPos = file.getLineAndCharacterOfPosition(node.getStart())
  const endPos = file.getLineAndCharacterOfPosition(node.getEnd())

  return new vscode.Range(
    new vscode.Position(startPos.line, startPos.character), 
    new vscode.Position(endPos.line, endPos.character)
  )
}

export default createRangeFromNode