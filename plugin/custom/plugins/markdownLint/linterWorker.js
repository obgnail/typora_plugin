const require = self.require;
const fs = require("fs");

let markdownlinter = null;
let disableRules = null;

const init = rules => {
    markdownlinter = require("./markdownlint.js").markdownlint;
    const result = {"default": true};
    for (const rule of rules) {
        result[rule] = false;
    }
    disableRules = result;
    console.debug("markdown linter worker initialed");
}

const lint = async filepath => {
    if (!markdownlinter || !disableRules) return;
    const fileContent = await fs.promises.readFile(filepath, 'utf-8');
    const {content} = markdownlinter.sync({strings: {content: fileContent}, config: disableRules});
    content.sort((a, b) => a.lineNumber - b.lineNumber);
    return content
}

self.onmessage = async ({data: {action, payload}}) => {
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
