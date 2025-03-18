let LIB
let RULES

const linter = {
    init: ({ libPath, config, content }) => {
        LIB = require(libPath)
        RULES = { "default": true, ...config }
        console.debug(`markdownlint@${LIB.getVersion()} worker is initialized with rules`, RULES)
        if (content) {
            return linter.check({ content })
        }
    },
    check: async ({ content }) => {
        const op = { strings: { content }, config: RULES }
        const result = await LIB.lint(op)
        return result.content.sort((a, b) => a.lineNumber - b.lineNumber)
    },
    fix: async ({ content, fixInfo }) => {
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
