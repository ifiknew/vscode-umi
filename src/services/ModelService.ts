import Registry from "../utils/Registry"
import * as ts from 'typescript'
import extractModelInfo, { ExtractActionInfo } from '../utils/parser/extractModelInfo';
import extractModelPathsFromWorkspace from '../utils/parser/extractModelPathsFromWorkspace';
import CompilerHostService from "./CompilerHostService";
import InMemoryFile from "../utils/InMemoryFile";

export interface ModelInfo {
  namespace: string
  reducers: Array<ExtractActionInfo>,
  effects: Array<ExtractActionInfo>,
  sourceFile: ts.SourceFile
}
export interface ActionInfo {
  type: string
  payload: ts.Type
  payloadRequired: boolean
  definition: ts.Node
  sourceFile: ts.SourceFile
}

@Registry.naming
class ModelService {

  @Registry.inject
  private compilerHostService?: CompilerHostService
  private modelInfos: Array<ModelInfo> = []
  private actionInfos: Array<ActionInfo> = []

  constructor() {
    this.compilerHostService!.addFiles(...extractModelPathsFromWorkspace())
    this.compilerHostService!.subscribeFileChange(({ path }) => {
      if (path.includes('/models/') && !path.includes(InMemoryFile.middleExt)) {
        this.extractModelInfos()
      }
    })
    this.extractModelInfos()
  }

  private extractModelInfos() {
    
    const program = this.compilerHostService!.getProgram()
    const checker = program.getTypeChecker()

    const files = program.getSourceFiles()
    const modelFiles = files.filter(v => v.fileName.includes('/src') && v.fileName.includes('/models') && !v.fileName.includes(InMemoryFile.middleExt))

    const modelInfos = modelFiles
      .map(v => ({ fileNode: v, symbol: checker.getSymbolAtLocation(v) }))
      .map(({ fileNode, symbol }) => {
        const exports = checker.getExportsOfModule(symbol!)
        const defaultExport = exports.find(v => v.name === 'default')

        // do some check to ensure only parse the correct models
        if (!defaultExport) { return null }
        const [ modelDeclaration = null ] = defaultExport.getDeclarations() || []
        if (
          !modelDeclaration 
          || modelDeclaration.kind !== ts.SyntaxKind.ExportAssignment
        ) {
          return null
        }

        const defaultExportType = checker.getTypeOfSymbolAtLocation(defaultExport, defaultExport.valueDeclaration)
        const modelInfo = extractModelInfo(defaultExportType, { checker })
        return {
          ...modelInfo,
          sourceFile: fileNode
        }
      })
      .filter(Boolean) as ModelInfo[]
    const actionInfos = modelInfos
      .map(v => [...v.reducers ,...v.effects].map(u => ({
        type: JSON.stringify(`${v.namespace}/${u.name}`), // add quote for action type string
        payload: u.type,
        payloadRequired: u.required,
        definition: u.declaration,
        sourceFile: v.sourceFile
      })))
      .reduce((arr, cur) => [...arr, ...cur], [])
    this.modelInfos = modelInfos
    this.actionInfos = actionInfos
  }

  public getModels() {
    return this.modelInfos
  }

  public getActions() {
    return this.actionInfos
  }
}

export default ModelService