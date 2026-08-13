require("./dom.mock")
const common = require("../../../plugin/global/core/components/common.js")
module.exports = { ...common, sharedSheets: [new CSSStyleSheet()], "@noCallThru": true }
