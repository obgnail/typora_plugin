let LIB
let RULE_CONFIG
let CUSTOM_RULES

const linter = {
    configure: ({ polyfillLib, coreLib, helpersLib, customRuleFiles, ruleConfig, content }) => {
        if (polyfillLib) {
            require(polyfillLib)
        }
        if (coreLib) {
            LIB = require(coreLib)
        }
        if (helpersLib && customRuleFiles) {
            const helpers = require(helpersLib)
            const define = (defineRule) => defineRule(helpers)  // Dependency Injection
            CUSTOM_RULES = customRuleFiles.map(require).flatMap(define)
        }
        if (ruleConfig) {
            RULE_CONFIG = ruleConfig
        }
        if (LIB) {
            console.debug(`[Markdownlint] markdownlint@${LIB.getVersion()} worker is configured with rules`, RULE_CONFIG)
        }
        if (content) {
            return linter.check({ content })
        }
    },
    check: async ({ content }) => {
        if (!LIB) return
        const op = { strings: { content }, config: RULE_CONFIG, customRules: CUSTOM_RULES }
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
