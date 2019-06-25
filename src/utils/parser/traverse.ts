import * as ts from 'typescript'

export enum TraverseAction {
  BlockChildren,
  BlockAll
}

function traverse(node: ts.Node, visitor: (node: ts.Node) => void | TraverseAction) {
  const action = visitor(node)
  if (action == null) {
    node.getChildren().forEach((child) => {
       const childAction = traverse(child, visitor)
       if (childAction === TraverseAction.BlockAll) {
         return TraverseAction.BlockAll
       }
    })
  }
  return action
}

export default traverse