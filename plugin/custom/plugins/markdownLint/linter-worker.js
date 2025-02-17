const require = self.require
const fs = require("fs").promises

let lib
let config = { default: true }

function init({ config }) {
    lazyLoad()
    assignConfig({ config })
    console.debug(`markdownLint@${lib.getVersion()} worker is initialized with rules`, config)
}

function assignConfig({ config: cfg }) {
    Object.assign(config, cfg)
}

function lazyLoad() {
    if (!lib) {
        lib = require("./markdownlint.min.js")
    }
}

async function checkContent({ fileContent }) {
    lazyLoad()
    const { content } = await lib.lint({ strings: { content: fileContent }, config })
    return content.sort((a, b) => a.lineNumber - b.lineNumber)
}

async function fixContent({ fileContent, fixInfo }) {
    lazyLoad()
    fixInfo = fixInfo || await checkContent({ fileContent })
    if (fixInfo && fixInfo.length) {
        return lib.applyFixes(fileContent, fixInfo)
    }
}

async function checkPath({ filePath }) {
    const fileContent = await fs.readFile(filePath, "utf-8")
    return checkContent({ fileContent })
}

async function fixPath({ filePath, fixInfo }) {
    const fileContent = await fs.readFile(filePath, "utf-8")
    return fixContent({ fileContent, fixInfo })
}

const linter = { init, assignConfig, checkContent, checkPath, fixContent, fixPath }

self.onmessage = async ({ data: { action, payload } }) => {
    if (!payload) return

    const func = linter[action]
    if (func) {
        const result = await func(payload)
        if (result) {
            self.postMessage({ action, result })
        }
        return
    }

    console.error("get error action:", action)
}
