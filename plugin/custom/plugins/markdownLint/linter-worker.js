const require = self.require;
const fs = require("fs").promises;

let markdownlint, lint, helpers;
let config = { default: true };

const assignConfig = cfg => Object.assign(config, cfg);

const initLibrary = () => {
    if (!markdownlint) {
        ({ markdownlint, helpers } = require("./markdownlint.min.js"));
        lint = markdownlint.promises.markdownlint;
    }
}

const init = cfg => {
    initLibrary();
    assignConfig(cfg);
    console.debug(`markdownLint@${markdownlint.getVersion()} worker is initialized with rules`, config);
}

const checkContent = async fileContent => {
    if (!markdownlint) {
        initLibrary();
    }
    const { content } = await lint({ strings: { content: fileContent }, config });
    content.sort((a, b) => a.lineNumber - b.lineNumber);
    return content
}
const checkPath = async filepath => {
    if (!markdownlint) {
        initLibrary();
    }
    const fileContent = await fs.readFile(filepath, "utf-8");
    return checkContent(fileContent)
}
const lintContent = async fileContent => {
    const info = await checkContent(fileContent);
    if (info && info.length) {
        return helpers.applyFixes(fileContent, info);
    }
}
const lintPath = async filepath => {
    const fileContent = await fs.readFile(filepath, "utf-8");
    return lintContent(fileContent)
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
