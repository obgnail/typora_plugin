let LIB
let RULES
let CUSTOM_RULES

const linter = {
    configure: ({ polyfillLib, lib, customRulesFiles, rules, content }) => {
        if (polyfillLib) {
            require(polyfillLib)
        }
        if (lib) {
            LIB = require(lib)
        }
        if (customRulesFiles) {
            CUSTOM_RULES = customRulesFiles.flatMap(e => require(e))
        }
        if (rules) {
            RULES = rules
        }
        if (LIB) {
            console.debug(`[Markdownlint] markdownlint@${LIB.getVersion()} worker is configured with rules`, RULES)
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
        if (LIB && fixInfo?.length) {
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
