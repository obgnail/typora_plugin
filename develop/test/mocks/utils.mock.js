// --- Global Environment Setup ---
Object.assign(global, {
    window: { _options: { appVersion: "1.0.0" } },
    document: { querySelector: () => undefined, querySelectorAll: () => [] },
    CSS: { supports: () => true },
    File: { option: { wordsPerMinute: 300 } },
    $: () => ({}),
})

const proxyquire = require("proxyquire")
const utils = proxyquire("../../../plugin/global/core/utils", { "fs-extra": { "@noCallThru": true } })
module.exports = utils
