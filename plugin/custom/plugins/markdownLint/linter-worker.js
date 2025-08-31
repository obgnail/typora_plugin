let LIB
let CUSTOM_RULES
let RULES

const linter = {
    configure: ({ libPath, customRulesFiles, rules, content }) => {
        if (libPath) {
            LIB = require(libPath)
        }
        if (customRulesFiles) {
            CUSTOM_RULES = customRulesFiles.flatMap(e => require(e))
        }
        if (rules) {
            RULES = rules
        }
        if (LIB) {
            console.debug(`markdownlint@${LIB.getVersion()} worker is initialized with rules`, RULES)
        }
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
    close: () => {
        self.close()
    },
}

self.onmessage = async (event) => {
    const { data: { action, payload } } = event
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
