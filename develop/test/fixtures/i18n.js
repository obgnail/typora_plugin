const i18n = require("../../../plugin/global/core/i18n.js")

module.exports = {
    get: async (locale = "zh-CN") => {
        await i18n.init(locale)
        return i18n
    },
}
