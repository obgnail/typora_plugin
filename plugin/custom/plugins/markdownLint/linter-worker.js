let lib
let config

const linter = {
    init: ({ libPath, config: cfg, content }) => {
        lib = require(libPath)
        config = { "default": true, ...cfg }
        console.debug(`markdownLint@${lib.getVersion()} worker is initialized with rules`, config)
        if (content) {
            return linter.check({ content })
        }
    },
    check: async ({ content }) => {
        const op = { strings: { content }, config }
        const result = await lib.lint(op)
        return result.content.sort((a, b) => a.lineNumber - b.lineNumber)
    },
    fix: async ({ content, fixInfo }) => {
        if (fixInfo && fixInfo.length) {
            return lib.applyFixes(content, fixInfo)
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
