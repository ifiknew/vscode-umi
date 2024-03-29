import * as vscode from 'vscode'
import * as ts from 'typescript'
import createDiagnostic from './createDiagnostic';

/**
 * get diagnostics of a node by matching the type
 * @param node the node to be parsed
 * @param type match a the 
 * to solve all types is of great complexity, see typescript/src/compiler/checker - checkSourceElementWorker to know what should be done  
 * here to support not all of them
 */
function getNodeDiagnostics(node: ts.Node, type: ts.Type, context: VisitorContext) {
  
  // if type provided is any, it means that no check should be done
  if (type.flags === ts.TypeFlags.Any) {
    return []
  }
  const nodeType = context.checker.getTypeAtLocation(node)
  
  return autoVisitor(nodeType, type, context)
}

interface VisitorContext {
  checker: ts.TypeChecker
  parent?: {
    nodeType: ts.Type,
    matchType: ts.Type,
    property?: ts.Symbol
  },
  originalMatchType?: ts.Type,
  isActionObject?: boolean,
}
/**
 * Visitors are functions to generate diagnostics for specific nodes
 */
interface Visitor {
  (nodeType: ts.Type, matchType: ts.Type, context: VisitorContext): vscode.Diagnostic[]
}

const autoVisitor: Visitor = (nodeType, matchType, context) => {
  const visitorDesc = visitorDescriptions.find(v => v.flags & nodeType.flags)

  // handle union or intersection type
  if (
    (nodeType.flags & ts.TypeFlags.Union)
    && !(nodeType.flags & ts.TypeFlags.EnumLike)
  ) {
    const types = (nodeType as ts.UnionType).types
    return types
      .map(v => autoVisitor(v, matchType, context))
      .sort((a, b) => a.length - b.length)
      [0]
  }
  if (nodeType.flags & ts.TypeFlags.Intersection) {
    const types = (nodeType as ts.IntersectionType).types
    return types
      .map(v => autoVisitor(v, matchType, context))
      .flat()
  }
  if (
    (matchType.flags & ts.TypeFlags.Union)
    && !(matchType.flags & ts.TypeFlags.EnumLike)
  ) {
    const types = (matchType as ts.UnionType).types
    return types
      .map(v => autoVisitor(nodeType, v, { ...context, originalMatchType: matchType }))
      .sort((a, b) => a.length - b.length)
      [0]
  }
  if (matchType.flags & ts.TypeFlags.Intersection) {
    const types = (matchType as ts.IntersectionType).types
    return types
      .map(v => autoVisitor(nodeType, v, { ...context, originalMatchType: matchType }))
      .flat()
  }

  return visitorDesc ? visitorDesc.visitor(nodeType, matchType, context) : []
}

const objectVisitor: Visitor = (nodeType, matchType, { checker, isActionObject }) => {
  const diagnostics: vscode.Diagnostic[] = []
  // check if object
  if (!(matchType.flags & ts.TypeFlags.Object)) {
    return [createDiagnostic(nodeType.symbol.declarations[0], `type ${checker.typeToString(matchType)} is required`)]
  }
  const nodeProperties = checker.getPropertiesOfType(nodeType)
  const matchProperties = checker.getPropertiesOfType(matchType)
  // check if all properties are defined in type to be matched
  // if true, visit recursively
  diagnostics.push(...nodeProperties
    .map(v => {
      if (isActionObject && v.name === 'type') { return [] }
      const matchPropertyTypeSymbol = matchProperties.find(u => v.name === u.name)
      const matchPropertyType = matchPropertyTypeSymbol ? checker.getTypeOfSymbolAtLocation(matchPropertyTypeSymbol, matchPropertyTypeSymbol.valueDeclaration) : undefined
      if (!matchPropertyType) {
        return [createDiagnostic(nodeType.symbol.declarations[0], `property '${v.name}' is not found in type ${checker.typeToString(matchType)}`)]
      }
      const nodePropertyType = checker.getTypeOfSymbolAtLocation(v, v.valueDeclaration)
      return autoVisitor(nodePropertyType, matchPropertyType, { checker, parent: { nodeType, matchType, property: v } })
    })
    .flat()
  )
  // check if lack of some properties defined in type to be matched
  diagnostics.push(...matchProperties
    .map(v => {
      if (
        (v.flags & ts.SymbolFlags.Optional) === 0 
        && !nodeProperties.some(u => u.name === v.name)
      ) {
        return [createDiagnostic(nodeType.symbol.declarations[0], `property '${v.name}' is required in type ${checker.typeToString(matchType)}`)]
      }
      return []
    })
    .flat()
  )
  return diagnostics
}

const enumVisitor: Visitor = (nodeType, matchType, context) => {
  if (nodeType === matchType) {
    return []
  }
  return generateSimpleTypeDiagnostics(nodeType, matchType, context)
}

const createLiteralVisitor: (flags: ts.TypeFlags) => Visitor = (flags) => (nodeType, matchType, context) => {
  if (matchType.flags & flags) {
    return []
  }
  return generateSimpleTypeDiagnostics(nodeType, matchType, context)
}

const generateSimpleTypeDiagnostics: Visitor = (nodeType, matchType, { checker, parent, originalMatchType }) => {
  if (parent && parent.nodeType.symbol.declarations) {
    return [
      createDiagnostic(
        parent.nodeType.symbol.declarations[0], 
        `type '${checker.typeToString(parent.nodeType)}' not match '${checker.typeToString(parent.matchType)}'`
      ),
      createDiagnostic(
        parent.nodeType.symbol.declarations[0],
        `type '${checker.typeToString(nodeType)}' not match '${checker.typeToString(originalMatchType || matchType)}'${parent.property ? ` in property '${parent.property.name || ''}'`: ''}`
      ),
    ]
  }
  return []
}

const visitorDescriptions: Array<{ flags: number, visitor: Visitor }> = [
  { flags: ts.TypeFlags.Object, visitor: objectVisitor },
  { flags: ts.TypeFlags.String, visitor: createLiteralVisitor(ts.TypeFlags.String) },
  { flags: ts.TypeFlags.Number, visitor: createLiteralVisitor(ts.TypeFlags.Number) },
  { flags: ts.TypeFlags.BooleanLiteral, visitor: createLiteralVisitor(ts.TypeFlags.BooleanLiteral) },
  { flags: ts.TypeFlags.EnumLiteral, visitor: enumVisitor },
]

export default getNodeDiagnostics