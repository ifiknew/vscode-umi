import Registry from "../utils/Registry"
import * as ts from 'typescript'
import * as vscode from 'vscode'
import ModelService, { ActionInfo } from "./ModelService"
import generateNodePath, { isWithin } from "../utils/parser/generateNodePath";
import createSourceFile from "../utils/parser/createSourceFile";
import CompilerHostService from "./CompilerHostService";
import createRangeFromNode from "../utils/parser/createRangeFromNode";
import Config from "../utils/Config";

interface ActionInfoWithNode extends ActionInfo {
  payloadNode: ts.Node
}

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
  
  provideSignatureHelp(
    document: vscode.TextDocument, 
    position: vscode.Position, 
    token: vscode.CancellationToken, 
    context: vscode.SignatureHelpContext
  ): vscode.ProviderResult<vscode.SignatureHelp> {
    const path = this.generateNodePath(document, position)
    return this.provideDispatchCallSignature(path, position)
  }

  /**
   * to complete type and payload within a dispatch call
   * @param nodes node path from the whole file to current node
   */
  private provideDispatchCallCompletion(nodes: ts.Node[]): vscode.CompletionItem[] {

    // to judge whether to provide type or payload completion
    // we extract object literal expressions from dispatch
    const objectLiteralExpressions = this.extractDispatchCallNodes(nodes)
    if (!objectLiteralExpressions) { return [] }

    // need to type '{}' before providing completion items
    if (objectLiteralExpressions.length === 0) {
      return []
    }

    const completionItems: vscode.CompletionItem[] = []
    // completion for type
    if (objectLiteralExpressions.length === 1) {
      const item = new vscode.CompletionItem('type', vscode.CompletionItemKind.Field)
      item.preselect = true
      item.kind = vscode.CompletionItemKind.Property
      item.detail = `(property) type: 'string'`

      item.filterText = item.insertText = `type: `
      
      const actions = this.modelService.getActions()
      if (actions.length) {
        item.insertText = new vscode.SnippetString('type: ${1|'+ actions.map(v => v.type).join(',') +'|}') 
      }
      completionItems.push(item)
    }

    // completion for action object
    if (objectLiteralExpressions.length >= 1) {

      // find action type
      const payload = objectLiteralExpressions[0]
      const actionTypeNode = payload.properties.find(v => v.name!.getText() === 'type') as ts.PropertyAssignment
      const actionTypeStr = actionTypeNode.initializer.getText()
      const actionType = this.modelService.getActions().find(v => v.type === actionTypeStr)!.action

      const current = objectLiteralExpressions[objectLiteralExpressions.length - 1]
      
      // we start from inside payload object and outside the one currently user is typing
      const actionKeyPath = objectLiteralExpressions.slice(0, -1).reduce<string[]>(
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
        actionType
      )
      const currentAvaliableProperties = checker.getPropertiesOfType(currentType)
      
      currentAvaliableProperties.forEach(v => {
        const item = new vscode.CompletionItem(v.getName(), vscode.CompletionItemKind.Field)
        item.preselect = true
        item.insertText = item.filterText = `${v.getName()}: `
        const propertyType = checker.getTypeOfSymbolAtLocation(v, v.valueDeclaration)
        const propertyTypeName = checker.typeToString(propertyType)
        item.detail = `(property) ${v.getName()}: ${propertyTypeName}`
        completionItems.push(item)
      })
    }
    return completionItems
  }

  /**
   * to peek or jump to code in models where current action is defined 
   */
  private provideDispatchCallDefinition(nodes: ts.Node[]): vscode.LocationLink[] {
    const actionInfo = this.extractActionInfo(nodes)
    if (!actionInfo) { return [] }
    const locationLinks: vscode.LocationLink[] = [
      {
        targetUri: vscode.Uri.file(actionInfo.sourceFile.fileName),
        targetRange: createRangeFromNode(actionInfo.definition),
        originSelectionRange: createRangeFromNode(actionInfo.payloadNode)
      }
    ]
    return locationLinks
  }

  private provideDispatchCallSignature(nodes: ts.Node[], position: vscode.Position): vscode.SignatureHelp | undefined {
    const dispatchCallIndex = nodes.findIndex(this.isDispatchCall)
    if (dispatchCallIndex === -1) { return undefined }

    const dispatchCall = nodes[dispatchCallIndex] as ts.CallExpression
    const currentNode = nodes[nodes.length - 1]

    // signature should be provided only for the first arg for dispatch function call
    const shouldProvide = 
      currentNode === dispatchCall
      || dispatchCall.arguments.length === 0
      || isWithin(
        dispatchCall.arguments[0], 
        currentNode.getSourceFile().getPositionOfLineAndCharacter(position.line, Math.max(0, position.character - 1))
      )
    if (!shouldProvide) { return undefined }

    const actionInfo = this.extractActionInfo(nodes)

    const actionTypeStr = actionInfo ? actionInfo.type : 'string'
    const originalActionObjectTypeStr = actionInfo ? this.compilerHostService.getProgram().getTypeChecker().typeToString(actionInfo.action) : 'object'

    const actionObjectTypeStr = `{ type: ${actionTypeStr}; ${originalActionObjectTypeStr.slice(1, -1)} }`
    let parameter: vscode.ParameterInformation | undefined = undefined
    if (actionInfo) {
      const parameterMarkdown = new vscode.MarkdownString()
      parameterMarkdown.appendCodeblock(actionObjectTypeStr, 'typescript')
      parameter = {
        label: '',
        documentation: parameterMarkdown
      }
    }
    const signatureMarkdown = new vscode.MarkdownString()
    signatureMarkdown.appendCodeblock(`dispatch(${actionObjectTypeStr}): any`, 'typescript')
    const signature: vscode.SignatureInformation = {
      label: '',
      documentation: signatureMarkdown,
      parameters: parameter ? [ parameter ] : []
    }
    const signatureHelp: vscode.SignatureHelp = {
      signatures: [signature],
      activeSignature: 0,
      activeParameter: 0
    }
    return signatureHelp
  }

  /**
   * find all nodes that current position is within
   */
  private generateNodePath(document: vscode.TextDocument, position: vscode.Position): ts.Node[] {
    const file = createSourceFile(document.getText())
    // find last character position as ts format
    const tsPosition = file.getPositionOfLineAndCharacter(position.line, Math.max(0, position.character))
    let path = generateNodePath(file, tsPosition)
    return path
  }

  private isDispatchCall(node: ts.Node): boolean {
    return ts.isCallExpression(node) && node.getChildAt(0).getLastToken()!.getText() === 'dispatch'
  }

  /**
   * extract payload node for use and query action infos from models and 
   */
  private extractActionInfo(nodes: ts.Node[]): ActionInfoWithNode | undefined {
    const objectLiteralExpressions = this.extractDispatchCallNodes(nodes)
    if (!objectLiteralExpressions || objectLiteralExpressions.length === 0) { return undefined }

    const payload = objectLiteralExpressions[0]
    const actionTypeNode = payload.properties.find(v => v.name!.getText() === 'type') as ts.PropertyAssignment
    const actionTypeStr = actionTypeNode.initializer.getText()
    const actionInfo = this.modelService.getActions().find(v => v.type === actionTypeStr)

    if (!actionInfo) { return undefined }
    return {
      ...actionInfo,
      payloadNode: payload
    }
  }

  /**
   * @returns if it's not a dispatch call, return undefined, otherwise return nodes of function parameters
   */
  private extractDispatchCallNodes(nodes: ts.Node[]): ts.ObjectLiteralExpression[] | undefined {
    const dispatchCallIndex = nodes.findIndex(this.isDispatchCall)
    if (dispatchCallIndex === -1) { return undefined }

    const objectLiteralExpressions = nodes
      .slice(dispatchCallIndex)
      .filter(ts.isObjectLiteralExpression)
    return objectLiteralExpressions
  }
}

export default LanguageService