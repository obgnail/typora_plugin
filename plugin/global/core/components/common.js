const sharedSheets = []

const push = (style) => {
    const sheet = new CSSStyleSheet()
    const targetSheet = [...document.styleSheets].find(s => s.href && s.href.includes(style))
    if (!targetSheet) return
    for (const cssRule of targetSheet.cssRules) {
        sheet.insertRule(cssRule.cssText)
    }
    sharedSheets.push(sheet)
}

push("font-awesome")
// push("ionicons")

module.exports = {
    sharedSheets
}
