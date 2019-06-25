import getStringValueFromText from "./getStringValueFromText";

function matchStringText(a: string, b: string) {
  return getStringValueFromText(a) === getStringValueFromText(b)
}

export default matchStringText