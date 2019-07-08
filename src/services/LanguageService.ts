import Registry from "../utils/Registry"
import * as ts from 'typescript'
import * as vscode from 'vscode'
import ModelService from "./ModelService"
import generateNodePath from "../utils/parser/generateNodePath";
import createSourceFile from "../utils/parser/createSourceFile";
import CompilerHostService from "./CompilerHostService";
import createRangeFromNode from "../utils/parser/createRangeFromNode";

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
    const path = this.generateNodePath(document, position)
    return this.provideDispatchCallCompletion(path)
  }

  provideDefinition(
    document: vscode.TextDocument, 
    position: vscode.Position, 
    token: vscode.CancellationToken
  ): vscode.LocationLink[] {
    const path = this.generateNodePath(document, position)
    return this.provideDispatchCallDefinition(path)
  }
  
  /**
   * find all nodes that current position is within
   */
  private generateNodePath(document: vscode.TextDocument, position: vscode.Position): ts.Node[] {
    const file = createSourceFile(document.getText())
    // find last character position as ts format
    const tsPosition = file.getPositionOfLineAndCharacter(position.line, Math.max(0, position.character - 1))
    let path = generateNodePath(file, tsPosition)
    return path
  }

  private isDispatchCall(node: ts.Node): boolean {
    return ts.isCallExpression(node) && node.getChildAt(0).getLastToken()!.getText() === 'dispatch'
  }

  /**
   * to complete type and payload within a dispatch call
   * @param nodes node path from the whole file to current node
   */
  private provideDispatchCallCompletion(nodes: ts.Node[]): vscode.CompletionItem[] {
    const dispatchCallIndex = nodes.findIndex(this.isDispatchCall)
    if (dispatchCallIndex === -1) { return [] }

    // to judge whether to provide type or payload completion
    // we extract object literal expressions from dispatch
    const objectLiteralExpressions = nodes
      .slice(dispatchCallIndex)
      .filter(ts.isObjectLiteralExpression)

    // need to type '{}' before providing completion items
    if (objectLiteralExpressions.length === 0) {
      return []
    }

    // completion for type and payload
    if (objectLiteralExpressions.length === 1) {
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

      const checker = this.compilerHostService.getProgram().getTypeChecker()
      let currentType = actionKeyPath.reduce(
        (type, cur) => {
          const curSymbol = checker.getPropertyOfType(type, cur)!
          return checker.getTypeOfSymbolAtLocation(curSymbol, curSymbol.valueDeclaration)
        },
        payloadType
      )
      const currentAvaliableProperties = checker.getPropertiesOfType(currentType)
      
      return currentAvaliableProperties.map(v => {
        const item = new vscode.CompletionItem(v.getName(), vscode.CompletionItemKind.Field)
        item.preselect = true
        item.insertText = item.filterText = `${v.getName()}: `
        const propertyType = checker.getTypeOfSymbolAtLocation(v, v.valueDeclaration)
        const propertyTypeName = checker.typeToString(propertyType)
        item.detail = `(property) ${v.getName()}: ${propertyTypeName}`
        return item
      })
    }
    return []
  }

  /**
   * 
   * @param nodes 
   */
  private provideDispatchCallDefinition(nodes: ts.Node[]): vscode.LocationLink[] {
    const dispatchCallIndex = nodes.findIndex(this.isDispatchCall)
    if (dispatchCallIndex === -1) { return [] }

    const objectLiteralExpressions = nodes
      .slice(dispatchCallIndex)
      .filter(ts.isObjectLiteralExpression)
    if (objectLiteralExpressions.length === 0) { return [] }

    const payload = objectLiteralExpressions[0]
    const actionTypeNode = payload.properties.find(v => v.name!.getText() === 'type') as ts.PropertyAssignment
    const actionTypeStr = actionTypeNode.initializer.getText()
    const actionInfo = this.modelService.getActions().find(v => v.type === actionTypeStr)!

    const locationLinks: vscode.LocationLink[] = [
      {
        targetUri: vscode.Uri.file(actionInfo.sourceFile.fileName),
        targetRange: createRangeFromNode(actionInfo.definition),
        originSelectionRange: createRangeFromNode(payload)
      }
    ]
    return locationLinks
  }

}

export default LanguageService