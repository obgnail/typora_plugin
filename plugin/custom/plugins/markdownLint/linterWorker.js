const require = self.require;
const fs = require("fs").promises;

let linter = null;
const config = { default: true, MD024: { siblings_only: true } };

const init = disabled => {
    if (!linter) {
        const { markdownlint } = require("./markdownlint.min");
        linter = markdownlint;
    }

    for (const rule of disabled) {
        config[rule] = false;
    }

    console.debug(`markdown linter worker is initialized with rules`, config);
}

const lintContent = fileContent => {
    if (!linter) return;
    const { content } = linter.sync({ strings: { content: fileContent }, config });
    content.sort((a, b) => a.lineNumber - b.lineNumber);
    return content
}

const lintPath = async filepath => {
    if (!linter) return;
    const fileContent = await fs.readFile(filepath, "utf-8");
    return lintContent(fileContent)
}

self.onmessage = async ({ data: { action, payload } }) => {
    if (!payload) return;

    if (action === "init") {
        init(payload);
    } else if (action === "lint-path") {
        const result = await lintPath(payload);
        self.postMessage(result);
    } else if (action === "lint-content") {
        const result = await lintContent(payload);
        self.postMessage(result);
    } else {
        console.error("get error action:", action);
    }
};
