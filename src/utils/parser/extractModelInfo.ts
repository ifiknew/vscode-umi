import * as ts from 'typescript'
interface ExtractContext {
  checker: ts.TypeChecker
}
/**
 * extract dva model info from the model's Type
 * @param type 
 */
function extractModelInfo(type: ts.Type, context: ExtractContext) {
  const [ 
    namespaceProperty, 
    stateProperty, 
    reducersProperty, 
    effectsProperty 
  ] = ['namespace', 'state', 'reducers', 'effects'].map(key => type.getProperty(key))

  const namespace = namespaceProperty ? extractNamespace(namespaceProperty) : ''
  const reducers = reducersProperty ? extractReducers(reducersProperty, context) : []
  const effects = effectsProperty ? extractEffects(effectsProperty, context) : []
  return {
    namespace,
    reducers,
    effects
  }
}

function extractNamespace(symbol: ts.Symbol) {
  const [ declaration ] = symbol.declarations
  const [ namespaceIdentifier, colon, namespaceValueToken ] = declaration.getChildren()
  return namespaceValueToken.getText().slice(1,-1) // remove queto
}

function extractReducers(symbol: ts.Symbol, option: ExtractContext) {
  return extractFunctionNameAndParameterTypesFromObjectSymbol(symbol, option)
    .map(v => {
      // we extract the type of the second function parameter as reducer payload type
      return {
        name: v.name,
        type: v.types[1]
      } 
    })
}

function extractEffects(symbol: ts.Symbol, option: ExtractContext) {
  return extractFunctionNameAndParameterTypesFromObjectSymbol(symbol, option)
    .map(v => {
      // we extract the type of the first function parameter as effect payload type
      return {
        name: v.name,
        type: v.types[0]
      } 
    })
}

/**
 * to extract functionNames and their parameters from an object
 * @param symbol the symbol represents an object which satisfies the type { [key: string]: Function }
 */
function extractFunctionNameAndParameterTypesFromObjectSymbol(symbol: ts.Symbol, { checker }: ExtractContext) {
  const type = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration)
  const properties = checker.getPropertiesOfType(type)

  const payloadTypes = properties.map(v => {
    const functionType = checker.getTypeOfSymbolAtLocation(v, v.valueDeclaration)
    const [ callSignature ] = functionType.getCallSignatures()
    return {
      name: v.name,
      types: callSignature.parameters
        .map(v => checker.getTypeOfSymbolAtLocation(v, v.valueDeclaration))
    }
  })

  return payloadTypes
}

export default extractModelInfo