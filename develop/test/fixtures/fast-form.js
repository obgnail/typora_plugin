const proxyquire = require("proxyquire")

function loadFastForm({ utils, i18n }) {
  const dir = "../../../plugin/global/core/components/fast-form"
  const depStubs = {
    "../common": require("../mocks/component_common.mock.js"),
    "../../utils": { ...utils, "@noCallThru": true },
    "../../i18n": { ...i18n, "@noCallThru": true },
  }
  const sub = (file) => ({ ...proxyquire(`${dir}/${file}`, depStubs), "@noCallThru": true })
  return proxyquire(`${dir}/index.js`, {
    ...depStubs,
    "./core": sub("core.js"),
    "./layouts": sub("layouts.js"),
    "./watchers": sub("watchers.js"),
    "./features": sub("features.js"),
    "./controls": sub("controls.js"),
  })
}

module.exports = loadFastForm
