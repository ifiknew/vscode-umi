const InMemoryFile = {
  middleExt: '.vscode.umi',
  regExp: /\.vscode\.umi\.(js|jsx|ts|tsx)$/,
  toInMemoryFileName: (fileName: string) => fileName.includes(InMemoryFile.middleExt) 
    ? fileName 
    : fileName.replace(/(\.[^.]*)$/, `${InMemoryFile.middleExt}$1`),
  toRealFileName: (inMemoryFileName: string) => inMemoryFileName.replace(InMemoryFile.middleExt, '')
}

export default InMemoryFile