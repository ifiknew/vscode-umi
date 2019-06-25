import * as ts from 'typescript'
import Workspace from '../Workspace';

function extractModelPathsFromWorkspace() {
  const modelPaths = ts.sys.readDirectory(Workspace.src)
    .filter(v => v.includes('/models'))
  return modelPaths
}

export default extractModelPathsFromWorkspace