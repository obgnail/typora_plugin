const require = self.require;
const fs = require("fs").promises;

let markdownlint, lint, helpers;
let config = { default: true };

function init({ config }) {
    initLibrary();
    assignConfig({ config });
    console.debug(`markdownLint@${markdownlint.getVersion()} worker is initialized with rules`, config);
}

function assignConfig({ config: cfg }) {
    Object.assign(config, cfg);
}

function initLibrary() {
    if (!markdownlint) {
        ({ markdownlint, helpers } = require("./markdownlint.min.js"));
        lint = markdownlint.promises.markdownlint;
    }
}

async function checkContent({ fileContent }) {
    if (!markdownlint) {
        initLibrary();
    }
    const { content } = await lint({ strings: { content: fileContent }, config });
    content.sort((a, b) => a.lineNumber - b.lineNumber);
    return content
}

async function checkPath({ filePath }) {
    if (!markdownlint) {
        initLibrary();
    }
    const fileContent = await fs.readFile(filePath, "utf-8");
    return checkContent({ fileContent })
}

async function lintContent({ fileContent, fixInfo }) {
    const info = fixInfo || await checkContent({ fileContent });
    if (info && info.length) {
        return helpers.applyFixes(fileContent, info);
    }
}

async function lintPath({ filePath, fixInfo }) {
    const fileContent = await fs.readFile(filePath, "utf-8");
    return lintContent({ fileContent, fixInfo });
}

const linter = { init, assignConfig, checkContent, checkPath, lintContent, lintPath };

self.onmessage = async ({ data: { action, payload } }) => {
    if (!payload) return;

    const func = linter[action];
    if (func) {
        const result = await func(payload);
        result && self.postMessage({ action, result });
        return;
    }

    console.error("get error action:", action);
}
