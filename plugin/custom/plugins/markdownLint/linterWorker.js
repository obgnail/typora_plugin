const require = self.require;
const fs = require("fs");

let markdownlinter = null;
const rules = {
    default: true,
    MD024: { siblings_only: true },
};

const init = disabled => {
    markdownlinter = require("./markdownlint.min").markdownlint;
    for (const rule of disabled) {
        rules[rule] = false;
    }
    console.debug(`markdown linter worker is initialized with rules`, rules);
}

const lint = async filepath => {
    if (!markdownlinter || !rules) return;
    const fileContent = await fs.promises.readFile(filepath, 'utf-8');
    const { content } = markdownlinter.sync({ strings: { content: fileContent }, config: rules });
    content.sort((a, b) => a.lineNumber - b.lineNumber);
    return content
}

self.onmessage = async ({ data: { action, payload } }) => {
    if (!payload) return;

    if (action === "init") {
        init(payload);
    } else if (action === "lint") {
        const result = await lint(payload);
        self.postMessage(result);
    } else {
        console.error("get error action:", action);
    }
};
