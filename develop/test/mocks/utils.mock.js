// --- Global Environment Setup ---
Object.assign(global, {
    window: { _options: { appVersion: "1.0.0" } },
    document: { querySelector: () => undefined, querySelectorAll: () => [] },
    CSS: { supports: () => true },
    File: { option: { wordsPerMinute: 300 } },
    $: () => ({}),
    _: require("lodash"),
})

const proxyquire = require("proxyquire")
module.exports = proxyquire("../../../plugin/global/core/utils", {
    "fs-extra": { ...require("fs-extra"), "@noCallThru": true },
})
