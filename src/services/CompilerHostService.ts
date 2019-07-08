import Registry from "../utils/Registry"
import * as ts from 'typescript'
import * as vscode from 'vscode'
import Workspace from "../utils/Workspace";
import * as fs from 'fs'
import InMemoryFile from "../utils/InMemoryFile";

interface FileChangeHandler {
  (file: { path: string }): void
}

interface DirectoryWatchHook {
  type: 'dir',
  path: string,
  callback: ts.DirectoryWatcherCallback
}
interface FileWatchHook {
  type: 'file',
  path: string,
  callback: ts.FileWatcherCallback
}
/**
 * A compiler host in response of file changes,
 * and a publisher of file changes
 */
@Registry.naming
class CompilerHostService {

  private watchProgram: ts.WatchOfFilesAndCompilerOptions<ts.SemanticDiagnosticsBuilderProgram>;

  /**
   * root files passed to compiler host
   */
  private files: string[] = [];

  /**
   * each time after compiler host has done current work, notify changes and clear this cache
   */
  private changedFiles: string[] = [];

  private inMemoryFiles: Map<string, string> = new Map();

  /**
   * used to notify changes for in memory files
   */
  private watchHooks: Array<DirectoryWatchHook | FileWatchHook> = [];

  private subscribers: Array<FileChangeHandler> = [];

  constructor() {

    // For pure type-checking scenarios, or when another tool/process handles emit,
    // using `createSemanticDiagnosticsBuilderProgram` may be more desirable.
    const createProgram = ts.createSemanticDiagnosticsBuilderProgram
    const host = ts.createWatchCompilerHost(
      [],
      {
        allowJs: true,
        noEmit: true // we do not want to emit output
      },
      ts.sys,
      createProgram,
      undefined,
      (diagnostic: ts.Diagnostic) => {
        // watch status changes not only on editing files
        // make sure those changed files are consumed before call for subscribers or dead loop occurs
        const notifyFiles = this.changedFiles
        this.changedFiles = []
        notifyFiles.forEach(filePath => {
          this.subscribers.forEach(f => f({ path: filePath }))
        })
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

    // override some functions for in memory files
    const proxyHost = host
    proxyHost.readFile = (path, encoding) => {
      if (InMemoryFile.regExp.test(path)) {
        return this.inMemoryFiles.get(path)
      }
      return ts.sys.readFile(path, encoding)
    }
    proxyHost.fileExists = (path) => {
      if (InMemoryFile.regExp.test(path)) {
        return this.inMemoryFiles.get(path) != null
      }
      return ts.sys.fileExists(path)
    }
    proxyHost.watchDirectory = (path, callback, recursive) => {
      this.watchHooks.push({
        type: 'dir',
        path,
        callback
      })
      return ts.sys.watchDirectory!(path, callback, recursive)
    }
    proxyHost.watchFile = (path, callback, pollingInterval) => {
      if (InMemoryFile.regExp.test(path)) {
        this.watchHooks.push({
          type: 'file',
          path,
          callback
        })
      }
      return ts.sys.watchFile!(path, callback, pollingInterval)
    }
    
    this.watchProgram = ts.createWatchProgram(proxyHost)
    
    // create a watcher to update host
    fs.watch(Workspace.src, { recursive: true }, (event, name) => {
      const filePath = `${Workspace.src}/${name}`
      if (event === 'change') {
        this.changedFiles.push(filePath)
      } else if (event === 'rename') {
        if (fs.existsSync(filePath)) {
          this.addFiles(filePath)
        } else {
          this.removeFiles(filePath)
        }
      }
    })

    // listen to the event when user openning a text editor or editing a document and 
    vscode.window.onDidChangeActiveTextEditor((e) => {
      if (!e) { return }
      const path = e.document.uri.path
      if (path.includes(Workspace.src)) {
        this.addFiles(path)
      }
    })
    vscode.workspace.onDidChangeTextDocument(({ document }) => {
      const fileName = InMemoryFile.toInMemoryFileName(document.fileName)
      this.updateInMemoryFile(fileName, document.getText())
    })

    // add files currently active
    this.addFiles(...vscode.window.visibleTextEditors.map(v => v.document.uri.path))
    
  }

  public addFiles(...fileNames: string[]) {
    this.files = [...this.files.filter(v => !fileNames.includes(v)), ...fileNames]
    this.changedFiles.push(...fileNames)
    this.updateRootFileNames()
  }

  public removeFiles(...fileNames: string[]) {
    this.files = this.files.filter(v => !fileNames.includes(v))
    this.updateRootFileNames()
  }

  public updateInMemoryFile(path: string, text: string) {
    const fileExists = this.inMemoryFiles.has(path)
    this.inMemoryFiles.set(path, text)
    this.changedFiles.push(path)
    if (!fileExists) {
      this.updateRootFileNames()
    }
    this.watchHooks.forEach(hook => {
      if (path.includes(hook.path)) {
        if (hook.type === 'dir') {
          hook.callback(path)
        } else {
          hook.callback(path, fileExists ? ts.FileWatcherEventKind.Changed : ts.FileWatcherEventKind.Created)
        }
      }
    })
  }

  public getProgram() {
    const builderProgram = this.watchProgram.getProgram()
    const program = builderProgram.getProgram()
    return program
  }

  /**
   * notice that file change only fired after compiler host done compliling
   */
  public subscribeFileChange(handler: FileChangeHandler) {
    this.subscribers = [...this.subscribers, handler]

    return () => this.subscribers = this.subscribers.filter(v => v !== handler)
  }

  private updateRootFileNames() {
    this.watchProgram.updateRootFileNames([...this.files, ...this.inMemoryFiles.keys()])
  }
}

export default CompilerHostService