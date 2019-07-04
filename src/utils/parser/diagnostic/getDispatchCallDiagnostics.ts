import * as ts from 'typescript'
import * as vscode from 'vscode'
import createDiagnostic from './createDiagnostic';
import { ActionInfo } from '../../../services/ModelService';
import matchStringText from '../matchStringText';
import getNodeDiagnostics from './getNodeDiagnostics';

/**
 * extract type errors from a dispatch call
 * @param node the node represents for the dispatch call, eg: this.props.dispatch({ type: 'app/init' })
 */
function getDispatchCallDiagnostics(node: ts.CallExpression, actionInfos: Array<ActionInfo>, { checker }: { checker: ts.TypeChecker }) {
  const args = node.arguments
  const diagnostics: vscode.Diagnostic[] = []

  // dispatch call has only one argument
  if (args.length !== 1) {
    diagnostics.push(createDiagnostic(
      node,
      args.length >= 2 ? 'dispatch call has only one argument' : 'Please complete dispatch call'
    ))
  } else {
    const actionNode = args[0]
    
    // the only argument should be an object
    if (!ts.isObjectLiteralExpression(actionNode)) {
      diagnostics.push(createDiagnostic(
        actionNode,
        'type not match { type: string, payload?: object }'
      ))
      return diagnostics
    } else {
      /**
       * rules for action type:  
       * - required
       * - should be PropertyAssignment
       * - value is string
       * - value in actionInfos
       */
      const typePropertyNode = actionNode.properties.find(v => v.name!.getText() === 'type')
      if (!typePropertyNode) {
        diagnostics.push(createDiagnostic(
          actionNode,
          'cannot find property type for Action { type: string, payload?: object }'
        ))
        return diagnostics
      }
      if (!ts.isPropertyAssignment(typePropertyNode)) {
        diagnostics.push(createDiagnostic(
          typePropertyNode, 
          'someting when wrong with your action type'
        ))
      } else {
        const typePropertyNodeInitializer = typePropertyNode.initializer
        if (!ts.isStringLiteral(typePropertyNodeInitializer)) {
          diagnostics.push(createDiagnostic(
            typePropertyNodeInitializer, 
            'property type should be string'
          ))
        } else {
          const actionTypeString = typePropertyNodeInitializer.getText()
          const actionInfo = actionInfos.find(v => matchStringText(v.type, actionTypeString))
          if (!actionInfo) {
            diagnostics.push(createDiagnostic(
              typePropertyNodeInitializer, 
              'cannot find a model action type name matches current one, perhaps spelling mistakes?'
            ))
          } else {
            /**
             * rules for action payload:  
             * - whether required
             * - if required, whether type match
             */
            const payloadPropertyNode = actionNode.properties.find(v => v.name!.getText() === 'payload')
            const payloadtype = actionInfo.payload
            if (!payloadPropertyNode && actionInfo.payloadRequired) {
              diagnostics.push(createDiagnostic(
                actionNode,
                `property payload is required in { type: ${actionInfo.type}, payload: ${checker.typeToString(payloadtype)} }`
              ))
            } else if (payloadPropertyNode && !actionInfo.type) {
              diagnostics.push(createDiagnostic(
                actionNode,
                `property payload is unnecessary in { type: ${actionInfo.type} }`
              ))
            } else if (payloadPropertyNode && ts.isPropertyAssignment(payloadPropertyNode)) {
              diagnostics.push(...getNodeDiagnostics(payloadPropertyNode.initializer, payloadtype, { checker }))
            }
            
          }
        }
      }
    }
  }
  return diagnostics
}

export default getDispatchCallDiagnostics