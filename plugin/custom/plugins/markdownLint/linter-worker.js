let LIB
let CUSTOM_RULES
const RULES = { "default": true }

const linter = {
    init: ({ libPath, customRulesFiles, config, content }) => {
        if (!LIB) {
            LIB = require(libPath)
        }
        if (!CUSTOM_RULES) {
            CUSTOM_RULES = customRulesFiles.flatMap(e => require(e))
        }
        Object.assign(RULES, config)
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
