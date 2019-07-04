/**
 * remove quotes for string
 */
function getStringValueFromText(s: string) {
  return [`'`, `"`].reduce(
    (str, quote) => {
      if (str.startsWith(quote) && str.endsWith(quote)) {
        return str.slice(1, -1)
      }
      return str
    },
    s
  )
}

export default getStringValueFromText