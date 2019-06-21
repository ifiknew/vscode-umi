import Registry from "../utils/Registry"
import * as ts from 'typescript'
import * as vscode from 'vscode'
import Workspace from "../utils/Workspace";
import * as fs from 'fs'

interface FileChangeHandler {
  (file: { path: string }): void
}

/**
 * A compiler host in response of file changes,
 * and a publisher of file changes
 */
@Registry.naming
class CompilerHostService {

  private watchProgram: ts.WatchOfFilesAndCompilerOptions<ts.SemanticDiagnosticsBuilderProgram>;

  private files: string[] = [];

  private subscribers: Array<FileChangeHandler> = [];

  constructor() {

    // For pure type-checking scenarios, or when another tool/process handles emit,
    // using `createSemanticDiagnosticsBuilderProgram` may be more desirable.
    const createProgram = ts.createSemanticDiagnosticsBuilderProgram
    const host = ts.createWatchCompilerHost(
      [],
      {
        noEmit: true // we do not want to emit output
      },
      ts.sys,
      createProgram,
      undefined,
      function reportWatchStatusChanged(diagnostic: ts.Diagnostic) {
        console.info(ts.formatDiagnostic(
          diagnostic, 
          {
            getCanonicalFileName: path => path,
            getCurrentDirectory: ts.sys.getCurrentDirectory,
            getNewLine: () => ts.sys.newLine
          }
        ))
      }
    )
    this.watchProgram = ts.createWatchProgram(host)

    // create a watcher to update host
    fs.watch(Workspace.src, { recursive: true }, (event, name) => {
      console.log(event, name)
      const filePath = `${Workspace.src}/${name}`
      if (event === 'change') {
        this.subscribers.forEach(f => f({ path: filePath }))
      } else if (event === 'rename') {
        if (fs.existsSync(filePath)) {
          this.addFiles(filePath)
        } else {
          this.removeFiles(filePath)
        }
      }
    })
    
    
    // listen to the event when user openning a text editor
    vscode.window.onDidChangeActiveTextEditor((e) => {
      if (!e) { return }
      const path = e.document.uri.path
      if (path.includes(Workspace.src)) {
        this.addFiles(path)
      }
    })

    // add files currently active
    this.addFiles(...vscode.window.visibleTextEditors.map(v => v.document.uri.path))
    
  }

  public addFiles(...fileNames: string[]) {
    this.files = [...this.files.filter(v => !fileNames.includes(v)), ...fileNames]
    this.watchProgram.updateRootFileNames(this.files)
  }

  public removeFiles(...fileNames: string[]) {
    this.files = this.files.filter(v => !fileNames.includes(v))
    this.watchProgram.updateRootFileNames(this.files)
  }

  public getProgram() {
    const builderProgram = this.watchProgram.getProgram()
    const program = builderProgram.getProgram()
    return program
  }

  public subscribeFileChange(handler: FileChangeHandler) {
    this.subscribers = [...this.subscribers, handler]

    return () => this.subscribers = this.subscribers.filter(v => v !== handler)
  }
}

export default CompilerHostService