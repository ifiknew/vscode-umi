import Registry from "../utils/Registry"
import * as ts from 'typescript'
import extractModelInfo from '../utils/extractModelInfo';
import extractModelPathsFromWorkspace from '../utils/extractModelPathsFromWorkspace';
import CompilerHostService from "./CompilerHostService";

interface ModelInfo {
  namespace: string;
  reducers: Array<{ name: string, type: ts.Type }>,
  effects: Array<{ name: string, type: ts.Type }>,
}

@Registry.naming
class ModelService {

  @Registry.inject
  private compilerHostService?: CompilerHostService;
  private modelInfos: Array<ModelInfo> = [];

  constructor() {
    this.compilerHostService!.addFiles(...extractModelPathsFromWorkspace())
    this.compilerHostService!.subscribeFileChange(({ path }) => {
      console.log(path)
      if (path.includes('/models/')) {
        this.extractModelInfos()
      }
    })
    this.extractModelInfos()
  }

  private extractModelInfos() {
    
    const program = this.compilerHostService!.getProgram()
    const checker = program.getTypeChecker()

    const files = program.getSourceFiles()
    const modelFiles = files.filter(v => v.fileName.includes('/src') && v.fileName.includes('/models'))

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
        return modelInfo
      })
      .filter(Boolean)
    this.modelInfos = modelInfos as any
  }

  public getModels() {
    return this.modelInfos
  }
}

export default ModelService