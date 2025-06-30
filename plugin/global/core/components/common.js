const sharedSheets = new CSSStyleSheet()

const loadStyle = (style) => {
    const sheet = [...document.styleSheets].find(e => e.href && e.href.includes(style))
    for (const rule of sheet.cssRules) {
        sharedSheets.insertRule(rule.cssText)
    }
}

loadStyle("font-awesome")
// loadStyle("ionicons")

module.exports = {
    sharedSheets
}
