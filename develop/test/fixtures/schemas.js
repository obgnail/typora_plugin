const I18N_FILES = require("./i18n_files.js")
const { schemas, i18n } = require("../../../plugin/preferences/schemas.js")

module.exports = {
    get: (locale) => {
        const i18nData = I18N_FILES[locale]?.obj ?? {}
        return i18n(schemas, i18nData)
    },
}
