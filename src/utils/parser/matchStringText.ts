import getStringValueFromText from "./getStringValueFromText";

/**
 * match two strings after leading and tail quotes removed
 */
function matchStringText(a: string, b: string) {
  return getStringValueFromText(a) === getStringValueFromText(b)
}

export default matchStringText