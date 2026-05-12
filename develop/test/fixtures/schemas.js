const proxyquire = require("proxyquire")
const I18N_FILES = require("./i18n_files.js")
const compile = require("../../../plugin/preferences/schemas.js")

function createMockDslContext() {
  Object.assign(global, {
    customElements: { define: () => null },
    HTMLElement: class {
    },
  })
  const FF = proxyquire("../../../plugin/global/core/components/fast-form/index.js", {
    "../common": { sharedSheets: [], "@noCallThru": true },
    "../../utils": { ...require("../mocks/utils.mock.js"), "@noCallThru": true },
    "../../i18n": { t: (s) => s, "@noCallThru": true },
  })

  const mockForm = {}
  FF.Feature_DSLEngine.onConstruct(mockForm)
  FF.Feature_StandardDSL.onConstruct(mockForm)
  return mockForm.dsl
}

module.exports = {
  get: (locale) => {
    const i18nData = I18N_FILES[locale]?.obj ?? {}
    const dsl = createMockDslContext()
    return compile(dsl, i18nData)
  },
}
