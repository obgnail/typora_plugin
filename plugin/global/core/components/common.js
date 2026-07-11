const createSheet = (name) => {
  const targetSheet = [...document.styleSheets].find(s => s.href?.includes(name))
  if (!targetSheet) return null
  const sheet = new CSSStyleSheet()
  Array.from(targetSheet.cssRules).forEach(rule => sheet.insertRule(rule.cssText))
  return sheet
}

const sharedSheets = ["font-awesome", "ionicons"].map(createSheet).filter(Boolean)

const createTemplate = (el) => {
  const tpl = document.createElement("template")
  tpl.innerHTML = el
  return tpl
}

module.exports = {
  sharedSheets,
  createTemplate,
}
