const sharedSheets = []

const addSharedSheet = (style) => {
    const sheet = new CSSStyleSheet()
    const targetSheet = [...document.styleSheets].find(s => s.href?.includes(style))
    if (!targetSheet) return
    for (const cssRule of targetSheet.cssRules) {
        sheet.insertRule(cssRule.cssText)
    }
    sharedSheets.push(sheet)
}

addSharedSheet("font-awesome")
// addSharedSheet("ionicons")

module.exports = {
    sharedSheets
}
