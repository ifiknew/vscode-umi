import * as ts from 'typescript'

function isWithin(node: ts.Node, position: number) {
  try {
    return node.pos <= position && position <= node.end
  } catch (e) {
    return false
  }
}

/**
 * find all ancestral nodes that current position passed by
 */
function generateNodePath(node: ts.Node, position: number) {
  const path: ts.Node[] = []
  let current: ts.Node | undefined = isWithin(node, position) ? node : undefined
  while (true) {
    if (!current || path.length > 100) { break }
    path.push(current)
    try {
      current = current.getChildren().find(v => isWithin(v, position))
    } catch (e) {
      current = undefined
    }
  }
  return path
}

export default generateNodePath