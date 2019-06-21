import * as vscode from 'vscode'

const [ rootFolder ] = vscode.workspace.workspaceFolders!

const root = rootFolder.uri.path

const Workspace = {
  root,
  src: `${root}/src`
}

export default Workspace