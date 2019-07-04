import * as vscode from 'vscode'
import * as ts from 'typescript'
import createDiagnostic from './createDiagnostic';
/**
 * get diagnostics of a node by matching the type
 * @param node the node to be parsed
 * @param type match a the 
 */
function getNodeDiagnostics(node: ts.Node, type: ts.Type, { checker }: { checker: ts.TypeChecker }) {
  
  // if type provided is any, it means that no check should be done
  if (type.flags === ts.TypeFlags.Any) {
    return []
  }

  if (ts.isObjectLiteralExpression(node)) {
    return visitObjectLiteralExpression(node, type, { checker })
  }

  return []
}

function visitObjectLiteralExpression(node: ts.ObjectLiteralExpression, type: ts.Type, { checker }: { checker: ts.TypeChecker }) {
  const diagnostics: vscode.Diagnostic[] = []
  // check if object
  if (type.flags !== ts.TypeFlags.Object) {
    return [createDiagnostic(node, `type ${checker.typeToString(type)} is required`)]
  }
  // check whether property keys match
  const properties = checker.getPropertiesOfType(type)
  diagnostics.push(...node.properties
    .map(v => {
      const propertyTypeSymbol = properties.find(u => v.name!.getText() === u.name)
      const propertyType = propertyTypeSymbol ? checker.getTypeOfSymbolAtLocation(propertyTypeSymbol, propertyTypeSymbol.valueDeclaration) : undefined
      if (!propertyType) {
        return [createDiagnostic(node, `property '${v.name!.getText()}' is not found in type ${checker.typeToString(type)}`)]
      }
      if (ts.isPropertyAssignment(v)) {
        return getNodeDiagnostics(v.initializer, propertyType, { checker })
      }
      return []
    })
    .reduce((a, b) => [...a, ...b], [])
  )
  diagnostics.push(...properties
    .map(v => {
      if (
        (v.flags & ts.SymbolFlags.Optional) === 0 
        && !node.properties.some(u => u.name!.getText() === v.name)
      ) {
        return [createDiagnostic(node, `property '${v.name}' is required in type ${checker.typeToString(type)}`)]
      }
      return []
    })
    .reduce((a, b) => [...a, ...b], [])
  )

  // check property values
  return node.properties
    .map(v => {
      return [] as vscode.Diagnostic[]
    })
    .reduce((a, b) => [...a, ...b], [])
    .concat(diagnostics)
}

export default getNodeDiagnostics