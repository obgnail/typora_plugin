const utils = require("./utils.mock.js")
const mockI18n = { t: k => k, link: a => a.join(" ") }

const createMockPlugin = (type = "base", fixedName = "testMockPlugin", setting = {}) => {
  const defaultSetting = { ENABLE: true, NAME: "Test Mock Plugin", ...setting }
  const base = { utils, fixedName, pluginName: defaultSetting.NAME, config: defaultSetting, i18n: mockI18n }
  return { ...base, call: () => undefined }
}

module.exports = createMockPlugin("base")
module.exports.createMockPlugin = createMockPlugin
