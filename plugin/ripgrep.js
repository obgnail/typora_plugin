class ripgrepPlugin extends BasePlugin {
    styleTemplate = () => ({topPercent: parseInt(this.config.TOP_PERCENT) + "%"})

    html = () => `
        <div id="plugin-ripgrep" class="plugin-common-modal plugin-common-hidden"> 
            <div id="plugin-ripgrep-form">
                <div class="plugin-ripgrep-prefix"><b>rg</b></div>
                <input type="text" placeholder='[options] PATTERN [path]'/>
            </div>
            <div class="plugin-ripgrep-output plugin-common-hidden"><pre tabindex="0"></pre></div>
        </div>
    `

    hotkey = () => [{hotkey: this.config.HOTKEY, callback: this.call}]

    init = () => {
        this.entities = {
            content: this.utils.entities.eContent,
            modal: document.getElementById("plugin-ripgrep"),
            input: document.querySelector("#plugin-ripgrep-form input"),
            output: document.querySelector(".plugin-ripgrep-output"),
            pre: document.querySelector(".plugin-ripgrep-output pre"),
        }
    }

    process = () => {
        this.entities.input.addEventListener("keydown", ev => {
            switch (ev.key) {
                case "Enter":
                    const input = ev.target.closest("input");
                    if (input) {
                        this.ripgrep(input.value);
                        ev.stopPropagation();
                        ev.preventDefault();
                    }
                    break;
                case "Escape":
                case "Backspace":
                    if (ev.key === "Escape" || ev.key === "Backspace" && this.config.BACKSPACE_TO_HIDE && !this.entities.input.value) {
                        ev.stopPropagation();
                        ev.preventDefault();
                        this.utils.hide(this.entities.modal);
                    }
                    break
            }
        })
    }

    call = () => {
        const {modal, input} = this.entities;
        if (this.utils.isShow(modal)) {
            this.utils.hide(modal);
        } else {
            const widthRatio = this.config.WIDTH_PERCENT / 100;
            const {width, left} = this.entities.content.getBoundingClientRect();
            this.entities.modal.style.width = width * widthRatio + "px";
            this.entities.modal.style.left = left + width * (1 - widthRatio) / 2 + "px";
            this.utils.show(modal);
            input.select();
        }
    }

    resetOutput = () => {
        this.entities.pre.textContent = "";
        this.entities.pre.classList.remove("error");
        this.utils.show(this.entities.output);
    }

    ripgrep = (args, callback) => {
        const argsList = this._parseCommandLineArgs(args);
        const onData = data => this.entities.pre.textContent += data.toString();
        const addErrorClass = this.utils.once(() => this.entities.pre.classList.add("error"));
        const onError = data => {
            this.entities.pre.textContent += data.toString();
            addErrorClass();
        }
        const onClose = callback || (code => undefined);
        this.resetOutput();
        this._ripgrep(argsList, onData, onError, onClose);
    }

    /**
     * Repo: https://github.com/microsoft/vscode-ripgrep
     * Note: ripgrep built in Typora, is written in rust, so if the search folder is very large, CPU may skyrocket during queries
     * Eg:
     *   _ripgrep(
     *       ["--max-filesize", "2M", "-g", "*.md", "XXX"],
     *       data => console.log(data),
     *       data => console.error(data),
     *       code => console.log("finish code:", code),
     *   );
     */
    _ripgrep = (args, onData, onErr, onClose) => {
        const rgPath = reqnode("vscode-ripgrep").rgPath.replace("node_modules.asar", "node_modules");
        const options = {cwd: File.getMountFolder(), stdio: ["ignore", "pipe", "pipe"], env: {rg: rgPath}};
        const child = this.utils.Package.ChildProcess.spawn(rgPath, args, options);
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", onData);
        child.stderr.on("data", onErr);
        child.on("close", onClose);
    }

    _parseCommandLineArgs = args => {
        const result = [];
        let currentArg = '';
        let inQuote = false;
        let escapeNextChar = false;

        for (let i = 0; i < args.length; i++) {
            const char = args[i];

            if (escapeNextChar) {
                currentArg += char;
                escapeNextChar = false;
            } else if (char === '\\') {
                escapeNextChar = true;
            } else if (char === ' ') {
                if (inQuote) {
                    currentArg += char;
                } else if (currentArg) {
                    result.push(currentArg);
                    currentArg = '';
                }
            } else if (char === '"') {
                if (inQuote) {
                    if (args[i - 1] !== '\\') {
                        inQuote = false;
                    }
                } else {
                    inQuote = true;
                }
            } else {
                currentArg += char;
            }
        }

        if (currentArg) {
            result.push(currentArg);
        }

        // Split options with values
        const parsedResult = [];
        for (const arg of result) {
            const equalIndex = arg.indexOf('=');
            if (equalIndex !== -1) {
                parsedResult.push(arg.substring(0, equalIndex));
                parsedResult.push(arg.substring(equalIndex + 1));
            } else {
                parsedResult.push(arg);
            }
        }

        return parsedResult;
    }
}

module.exports = {
    plugin: ripgrepPlugin
};
