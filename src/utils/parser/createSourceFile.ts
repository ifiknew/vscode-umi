import * as ts from 'typescript'

let cache = {
  text: '',
  sourceFile: undefined as ts.SourceFile | undefined
}

/**
 * to generate an ast for single file,
 * cache is used when text matches exactly
 * @param code the .tsx? file code to parse
 */
function createSourceFile(text: string): ts.SourceFile {
  if (!text) { throw new Error('No source code provided') }
  if (cache.text.length === text.length && cache.text === text) {
    return cache.sourceFile!
  }
  cache.text = text
  cache.sourceFile = ts.createSourceFile('', text, ts.ScriptTarget.Latest, true)
  return cache.sourceFile
}

export default createSourceFile