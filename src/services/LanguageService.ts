import Registry from "../utils/Registry"
import * as ts from 'typescript'
import * as vscode from 'vscode'
import ModelService from "./ModelService"
import CompilerHostService from "./CompilerHostService";
import generateNodePath from "../utils/generateNodePath";

@Registry.naming
class LanguageService {

  @Registry.inject
  private modelService!: ModelService

  @Registry.inject
  private compilerHostService!: CompilerHostService

  provideCompletionItems(
    document: vscode.TextDocument, 
    position: vscode.Position, 
    token: vscode.CancellationToken, 
    context: vscode.CompletionContext
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {

    const file = ts.createSourceFile('', document.getText(), ts.ScriptTarget.Latest, true)

    // find last character position as ts format
    const tsPosition = file.getPositionOfLineAndCharacter(position.line, Math.max(0, position.character - 1))
    let path = generateNodePath(file, tsPosition)
    
    const items: vscode.CompletionItem[] = []
    items.push(...this.provideDispatchCall(path))

    console.log(path)
    console.log(path.map(v => v.getText()))
    console.log(items)
		return items
  }
  
  private provideDispatchCall(nodes: ts.Node[]) {
    const dispatchCallIndex = nodes
      .findIndex(v => 
        v.kind === ts.SyntaxKind.CallExpression 
        && v.getChildAt(0).getLastToken()!.getText() === 'dispatch'
      )
    if (dispatchCallIndex === -1) { return [] }

    // to judge whether to provide type or payload completion
    // we extract object literal expressions from dispatch
    const objectLiteralExpressions = nodes
      .slice(dispatchCallIndex)
      .filter(v => v.kind === ts.SyntaxKind.ObjectLiteralExpression) as ts.ObjectLiteralExpression[]

    // need to type '{}' before providing completion items
    if (objectLiteralExpressions.length === 0) {
      return []
    }

    // completion for type and payload
    if (objectLiteralExpressions.length === 1) {
      const current = nodes[nodes.length - 1]
      const currentText = current.getText()
      return [
        ...['type', 'payload'].map(key => {
          const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Field)
          item.preselect = true
          item.kind = vscode.CompletionItemKind.Property
          item.detail = `(property) ${key}: ${key === 'type' ? 'string' : 'object'}`

          item.filterText = `${key}: `
          item.insertText = `${key}: `
          
          if (key === 'type') {
            const actions = this.modelService.getActions()
            if (actions.length) {
              item.insertText = new vscode.SnippetString('type: ${1|'+ actions.map(v => v.type).join(',') +'|},$0') 
            }
          }
          
          return item
        })
      ]
    }

    // completion for payload object
    if (objectLiteralExpressions.length > 1) {

      // find payload type
      const payload = objectLiteralExpressions[0]
      const actionTypeNode = payload.properties.find(v => v.name!.getText() === 'type') as ts.PropertyAssignment
      const actionTypeStr = actionTypeNode.initializer.getText()
      const payloadType = this.modelService.getActions().find(v => v.type === actionTypeStr)!.payload

      const current = objectLiteralExpressions[objectLiteralExpressions.length - 1]
      
      // we start from inside payload object and outside the one currently user is typing
      const actionKeyPath = objectLiteralExpressions.slice(1, -1).reduce<string[]>(
        (path, cur) => {
          const identifier = cur.properties.find(v => v.pos <= current.pos && current.end <= v.end)
          return [...path, identifier!.name!.getText()]
        },
        []
      )

      const checker = (payloadType as unknown as { checker: ts.TypeChecker }).checker
      let currentType = actionKeyPath.reduce(
        (type, cur) => {
          const curSymbol = checker.getPropertyOfType(payloadType, cur)!
          return checker.getTypeOfSymbolAtLocation(curSymbol, curSymbol.valueDeclaration)
        },
        payloadType
      )
      const currentAvaliableProperties = checker.getPropertiesOfType(payloadType)
      
      return currentAvaliableProperties.map(v => {
        const item = new vscode.CompletionItem(v.getName(), vscode.CompletionItemKind.Property)
        item.preselect = true
        item.insertText = item.filterText = `${v.getName()}: `
        item.detail = `(property) ${v.getName()}: any`
        return item
      })
    }
    return []
  }
}

export default LanguageService