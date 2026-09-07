// --- Global Environment Setup ---
Object.assign(global, {
  window: { _options: { appVersion: "1.0.0" } },
  document: { querySelector: () => undefined, querySelectorAll: () => [] },
  CSS: { supports: () => true, escape: s => s },
  File: { option: { wordsPerMinute: 300 } },
  $: () => ({}),
  dirname: require("os").tmpdir(),
})

const proxyquire = require("proxyquire")
const mockUtils = proxyquire("../../../plugin/global/core/utils", {
  "fs-extra": { ...require("fs-extra"), "@noCallThru": true },
})

Object.values(mockUtils.mixins).forEach(mixin => {
  ["process", "postprocess"].forEach(name => {
    if (Object.hasOwn(mixin, name)) mixin[name] = () => undefined
  })
})

module.exports = mockUtils
