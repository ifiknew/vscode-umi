import * as vscode from 'vscode'
import * as ts from 'typescript'
import Registry from '../utils/Registry';
import traverse, { TraverseAction } from '../utils/parser/traverse';
import getDispatchCallDiagnostics from '../utils/parser/diagnostic/getDispatchCallDiagnostics';
import ModelService from '../services/ModelService';
import CompilerHostService from '../services/CompilerHostService';
import InMemoryFile from '../utils/InMemoryFile';

/**
 * to generate diagnostics when doc changeed
 */
@Registry.naming
export default class DiagnosticPlugin {

  @Registry.inject
  private compilerHostService!: CompilerHostService

  @Registry.inject
  private modelService!: ModelService

  private diagnosticCollection: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection('umi')

  private disposables: vscode.Disposable[] = []
  
  constructor() {
    const unsubscribe = this.compilerHostService.subscribeFileChange(({ path }) => {
      this.provideDiagnostics(path)
    })
    vscode.window.onDidChangeActiveTextEditor(e => {
      if (!e) { return }
      this.provideDiagnostics(e.document.fileName)
    })
    this.disposables.push({
      dispose: unsubscribe
    })
  }

  private provideDiagnostics(fileName: string) {
    // only provide diagnostics for current active file
    if (
      !vscode.window.activeTextEditor 
      || !(InMemoryFile.toRealFileName(fileName) === vscode.window.activeTextEditor.document.fileName)
    ) {
      return []
    }

    this.diagnosticCollection.clear()
    const diagnostics: vscode.Diagnostic[] = []
    const program = this.compilerHostService.getProgram()
    
    // priority given to in memory file
    const file = program.getSourceFile(InMemoryFile.toInMemoryFileName(fileName)) || program.getSourceFile(fileName)
    if (!file) { return }

    // check dispatch call
    traverse(file, node => {
      if (
        ts.isCallExpression(node)
        && node.getChildAt(0).getLastToken()!.getText() === 'dispatch'
      ) {
        diagnostics.push(...getDispatchCallDiagnostics(
          node, 
          this.modelService.getActions(), 
          { checker: program.getTypeChecker() }
        ))
        return TraverseAction.BlockChildren
      }
    })
    this.diagnosticCollection.set(vscode.Uri.file(InMemoryFile.toRealFileName(fileName)), diagnostics)
  }

  public dispose() {
    this.disposables.forEach(v => v.dispose())
  }
}