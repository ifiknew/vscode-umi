import * as ts from 'typescript'

interface ExtractContext {
  checker: ts.TypeChecker
}

function extractPropertyTypeFromObjectType(objectType: ts.Type, propertyKey: string, { checker }: ExtractContext) {
  const properties = checker.getPropertiesOfType(objectType)

  return null
}