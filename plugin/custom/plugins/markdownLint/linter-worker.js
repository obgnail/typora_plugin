let LIB
let RULES
let CUSTOM_RULES

const linter = {
    init: ({ libPath, customRulePaths, config, content }) => {
        LIB = require(libPath)
        RULES = { "default": true, ...config }
        CUSTOM_RULES = customRulePaths.map(e => require(e))
        console.debug(`markdownlint@${LIB.getVersion()} worker is initialized with rules`, RULES)
        if (content) {
            return linter.check({ content })
        }
    },
    check: async ({ content }) => {
        if (!LIB) return
        const op = { strings: { content }, config: RULES, customRules: CUSTOM_RULES }
        const result = await LIB.lint(op)
        return result.content
    },
    fix: async ({ content, fixInfo }) => {
        if (!LIB) return
        if (fixInfo && fixInfo.length) {
            return LIB.applyFixes(content, fixInfo)
        }
    },
}

onmessage = async ({ data: { action, payload } }) => {
    if (!payload) return

    const fn = linter[action]
    if (!fn) {
        console.error("get error action:", action)
        return
    }
    const result = await fn(payload)
    if (result) {
        postMessage({ action, result })
    }
}
