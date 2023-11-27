class markdownLintPlugin extends BaseCustomPlugin {
    styleTemplate = () => true

    hint = () => "点击出现弹窗，再次点击隐藏弹窗"

    hotkey = () => [this.config.hotkey]

    htmlTemplate = () => {
        const pre = [{ele: "pre", tabindex: "0"}]
        const el = [{id: "plugin-markdownlint", class_: "plugin-common-modal", style: {display: "none"}, children: pre}]
        if (this.config.use_button) {
            el.push({id: "plugin-markdownlint-button", "ty-hint": "markdown格式规范检测"})
        }
        return el
    }

    process = () => {
        this.markdownlint = null;
        this.disableRules = null;
        this.entities = {
            modal: document.querySelector("#plugin-markdownlint"),
            pre: document.querySelector("#plugin-markdownlint pre"),
            button: document.querySelector("#plugin-markdownlint-button"),
        }

        if (this.entities.button) {
            this.entities.button.addEventListener("click", this.callback);
        }
        if (this.config.allow_drag) {
            this.utils.dragFixedModal(this.entities.modal, this.entities.modal, true);
        }
        this.utils.addEventListener(this.utils.eventType.firstFileInit, () => setTimeout(this.renewLintResult, 500));
        const debounce = this.utils.debounce(this.updateAll, Math.max(2500, this.config.debounce_interval - 500));
        this.utils.addEventListener(this.utils.eventType.fileEdited, debounce);
    }

    callback = async anchorNode => {
        if (this.entities.modal.style.display === "none") {
            const content = await this.renewLintResult();
            await this.updateModal(content);
            this.entities.modal.style.display = "";
        } else {
            this.entities.modal.style.display = "none";
        }
    }

    updateAll = async () => {
        console.debug("markdown lint detector");
        const content = await this.renewLintResult();
        if (this.entities.modal.style.display !== "none") {
            await this.updateModal(content);
        }
    }

    updateModal = async content => {
        this.entities.pre.textContent = (!content.length)
            ? this.config.pass_text
            : "line  rule   description\n" + content.map(line => {
                const lineNo = line.lineNumber + "";
                return "\n" + lineNo.padEnd(6) + line.ruleNames[0].padEnd(7) + line.ruleDescription;
            }
        )
    }

    renewLintResult = async () => {
        this.lazyLoad();
        this.initDisableRules();
        // if (this.utils.getFilePath()) {
        //     await File.saveUseNode();
        // }
        const fileContent = await File.getContent();
        const {content} = this.markdownlint.sync({strings: {content: fileContent}, config: this.disableRules});
        content.sort((a, b) => a.lineNumber - b.lineNumber);
        this.setButtonColor(content);
        return content
    }

    setButtonColor = content => {
        if (this.entities.button) {
            this.entities.button.style.backgroundColor = (content.length) ? this.config.error_color : this.config.pass_color;
        }
    }

    initDisableRules = () => {
        if (!this.disableRules) {
            const rules = {"default": true};
            for (const rule of this.config.disable_rules) {
                rules[rule] = false
            }
            this.disableRules = rules;
        }
    }

    lazyLoad = () => {
        if (!this.markdownlint) {
            const {markdownlint} = this.utils.requireFilePath("./plugin/custom/plugins/markdownLint/markdownlint.js");
            this.markdownlint = markdownlint;
        }
    }
}

module.exports = {
    plugin: markdownLintPlugin
};
