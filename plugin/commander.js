class commanderPlugin extends BasePlugin {
    beforeProcess = () => {
        this.SHELL = {CMD_BASH: "cmd/bash", POWER_SHELL: "powershell", GIT_BASH: "gitbash", WSL: "wsl"};
    }

    styleTemplate = () => true

    html = () => {
        const {USE_BUILTIN, BUILTIN} = this.config;
        const {CMD_BASH, POWER_SHELL, GIT_BASH, WSL} = this.SHELL;
        const genShell = (shell, text) => `<option value="${shell}">${text}</option>`;

        const shells = [genShell(CMD_BASH, "cmd/bash")];
        if (File.isWin) {
            shells.push(genShell(POWER_SHELL, "PowerShell"), genShell(GIT_BASH, "Git Bash"), genShell(WSL, "WSL"))
        }

        let builtinSelect = "";
        if (USE_BUILTIN) {
            const builtin = BUILTIN.map(e => `<option shell="${e.shell}" value="${this.utils.escape(e.cmd)}">${e.name}</option>`);
            builtinSelect = `<select class="plugin-commander-builtin">${builtin.join("")}</select>`;
        }

        return `
            <div id="plugin-commander" class="plugin-common-modal plugin-common-hidden"> 
                <div id="plugin-commander-form">
                    <input type="text" placeholder="Typora commander" title="提供如下环境变量:\n$f 当前文件路径\n$d 当前文件所属目录\n$m 当前挂载目录"/>
                    <i class="ion-ios7-play plugin-commander-commit plugin-common-hidden" ty-hint="执行命令"></i>
                    <select class="plugin-commander-shell">${shells.join("")}</select>
                    ${builtinSelect}
                </div>
                <div class="plugin-commander-output plugin-common-hidden"><pre tabindex="0"></pre></div>
            </div>
        `
    }

    hotkey = () => {
        const hotkeys = [{hotkey: this.config.HOTKEY, callback: this.call}];
        if (this.config.USE_BUILTIN) {
            this.config.BUILTIN.forEach(ele => {
                if (ele.hotkey && ele.cmd && ele.shell) {
                    hotkeys.push({hotkey: ele.hotkey, callback: () => this.quickExecute(ele.cmd, ele.shell)});
                }
            })
        }
        return hotkeys
    }

    init = () => {
        this.modal = {
            modal: document.getElementById('plugin-commander'),
            input: document.querySelector("#plugin-commander-form input"),
            shellSelect: document.querySelector("#plugin-commander-form .plugin-commander-shell"),
            builtinSelect: document.querySelector("#plugin-commander-form .plugin-commander-builtin"),
            commit: document.querySelector("#plugin-commander-form .plugin-commander-commit"),
            output: document.querySelector(".plugin-commander-output"),
            pre: document.querySelector(".plugin-commander-output pre"),
        }

        this.arg_value_prefix = "call_builtin@";
        this.callArgs = [{arg_name: "显示/隐藏", arg_value: "show"}];
        this.config.BUILTIN.forEach(builtin => {
            if (builtin.name) {
                this.callArgs.push({arg_name: builtin.name, arg_value: this.arg_value_prefix + builtin.name});
            }
        });
    }

    process = () => {
        if (!this.config.USE_BUILTIN) {
            this.modal.modal.style.width = "500px";
            this.modal.input.style.width = "80%";
            this.modal.commit.style.left = "375px";
        }

        // 提供不同入口，让鼠标操作的用户不必切换回键盘操作
        this.modal.commit.addEventListener("click", ev => {
            this.commitExecute();
            ev.stopPropagation();
            ev.preventDefault();
        }, true);

        this.modal.input.addEventListener("input", () => {
            const cmd = this.modal.input.value.trim();
            if (cmd) {
                this.utils.show(this.modal.commit);
            } else {
                this.utils.hide(this.modal.commit);
                this.modal.builtinSelect.value = "";
            }
        })

        this.modal.shellSelect.addEventListener("change", () => this.modal.input.focus());

        this.modal.modal.addEventListener("keydown", ev => {
            switch (ev.key) {
                case "Enter":
                    const input = ev.target.closest("input")
                    if (input) {
                        this.commitExecute();
                        ev.stopPropagation();
                        ev.preventDefault();
                    }
                    break
                case "Escape":
                case "Backspace":
                    if (ev.key === "Escape" || ev.key === "Backspace" && this.config.BACKSPACE_TO_HIDE && !this.modal.input.value) {
                        ev.stopPropagation();
                        ev.preventDefault();
                        this.utils.hide(this.modal.modal);
                    }
                    break
                case "Tab":
                    const targetClass = this.config.USE_BUILTIN ? ".plugin-commander-builtin" : ".plugin-commander-shell";
                    const target = ev.target.closest(targetClass);
                    if (target) {
                        ev.stopPropagation();
                        ev.preventDefault();
                        this.modal.input.focus();
                    }
                    break
            }
        })

        if (this.config.USE_BUILTIN) {
            this.modal.builtinSelect.addEventListener("change", () => {
                const option = this.modal.builtinSelect.options[this.modal.builtinSelect.selectedIndex];
                this.modal.shellSelect.value = option.getAttribute("shell");
                this.modal.input.value = option.value;
                this.modal.input.dispatchEvent(new CustomEvent('input'));
                this.modal.input.focus();
            })
        }

        if (this.config.ALLOW_DRAG) {
            this.utils.dragFixedModal(this.modal.input, this.modal.modal);
        }
    }

    convertPath = (path, shell) => {
        if (File.isMac || File.isLinux) return path

        switch (shell) {
            case this.SHELL.WSL:
                return '/mnt' + this.utils.windowsPathToUnix(path)
            case this.SHELL.GIT_BASH:
                return this.utils.windowsPathToUnix(path)
            case this.SHELL.CMD_BASH:
            case this.SHELL.POWER_SHELL:
            default:
                return path
        }
    }

    getFile = shell => this.convertPath(this.utils.getFilePath(), shell);
    getFolder = shell => this.convertPath(this.utils.getCurrentDirPath(), shell);
    getMountFolder = shell => this.convertPath(this.utils.getMountFolder(), shell);

    replaceArgs = (cmd, shell) => {
        const file = this.getFile(shell);
        const folder = this.getFolder(shell);
        const mount = this.getMountFolder(shell);
        cmd = cmd.replace(/\$f/g, `"${file}"`)
            .replace(/\$d/g, `"${folder}"`)
            .replace(/\$m/g, `"${mount}"`);
        return cmd
    }

    getShellCommand = env => {
        switch (env) {
            case this.SHELL.GIT_BASH:
                return `bash.exe -c`
            case this.SHELL.POWER_SHELL:
                return `powershell /C`
            case this.SHELL.WSL:
                return `wsl.exe -e bash -c`
            default:
                return (File.isMac || File.isLinux) ? `bash -c` : `cmd /C`;
        }
    }

    normalizeModal = (cmd, shell, hint) => {
        this.modal.input.value = cmd;
        this.modal.shellSelect.value = shell;
        this.utils.show(this.modal.commit);
        typeof hint === "string" && this.showStdout(hint);
    }

    normalizeCommand = (cmd, shell) => {
        cmd = this.replaceArgs(cmd, shell);
        shell = this.getShellCommand(shell);
        return [cmd, shell]
    }

    showStdout = stdout => {
        this.utils.show(this.modal.modal);
        this.utils.show(this.modal.output);
        this.modal.pre.classList.remove("error");
        this.modal.pre.textContent = stdout;
    }

    showStdErr = stderr => {
        this.showStdout(stderr);
        this.modal.pre.classList.add("error");
    }

    // 为什么不使用shell options? 答：不能支持wsl
    // 为什么不使用env options?   答：为了兼容。cmd使用变量的方式为%VAR%，bash为$VAR。而且命令可能会跨越多层shell
    exec = (cmd, shell, resolve, reject, callback, hint, options) => {
        resolve = resolve || console.log;
        reject = reject || console.error;
        options = options || {};
        const cb = (err, stdout, stderr) => callback && callback(err, stdout, stderr);

        const prefix = File.isWin ? `chcp 65001 |` : "";
        this.normalizeModal(cmd, shell, hint);
        const [cmd_, shell_] = this.normalizeCommand(cmd, shell)
        const command_ = `${prefix} ${shell_} "${cmd_}"`;
        const defaultOptions = {encoding: 'utf8', cwd: this.getFolder()};
        const option_ = {...defaultOptions, ...options};
        const callback_ = (err, stdout, stderr) => {
            if (err || stderr.length) {
                reject(err || stderr.toString());
            } else {
                resolve(stdout);
            }
            cb(err, stdout, stderr);
        }
        this.utils.Package.ChildProcess.exec(command_, option_, callback_);
    }

    spawn = (cmd, shell, resolve, reject, callback, hint, options) => {
        resolve = resolve || console.log;
        reject = reject || console.error;
        options = options || {};
        const cb = code => callback && callback(code);

        const prefix = File.isWin ? "chcp 65001 |" : "";
        this.normalizeModal(cmd, shell, hint || ""); // 执行前清空输出
        const [cmd_, shell_] = this.normalizeCommand(cmd, shell)
        const command_ = `${prefix} ${shell_} "${cmd_}"`;
        const defaultOptions = {encoding: 'utf8', cwd: this.getFolder(), shell: true};
        const option_ = {...defaultOptions, ...options};
        const child = this.utils.Package.ChildProcess.spawn(command_, option_);
        child.stdout.on('data', resolve);
        child.stderr.on("data", reject);
        child.on('close', cb);
    }

    silentExec = (cmd, shell, callback, hint, options) => this.exec(cmd, shell, null, null, callback, hint, options);
    errorExec = (cmd, shell, callback, hint, options) => this.exec(cmd, shell, null, this.showStdErr, callback, hint, options);
    alwaysExec = (cmd, shell, callback, hint, options) => this.exec(cmd, shell, this.showStdout, this.showStdErr, callback, hint, options);
    echoExec = (cmd, shell, callback, hint, options) => {
        const resolve = data => this.modal.pre.textContent += data.toString();
        const addErrorClass = this.utils.once(() => this.modal.pre.classList.add("error"));
        const reject = data => {
            this.modal.pre.textContent += data.toString();
            addErrorClass();
        }
        this.spawn(cmd, shell, resolve, reject, callback, hint, options);
    }

    execute = (type, cmd, shell, callback, hint, options) => {
        switch (type) {
            case "always":
                return this.alwaysExec(cmd, shell, callback, hint, options)
            case "error":
                return this.errorExec(cmd, shell, callback, hint, options)
            case "silent":
                return this.silentExec(cmd, shell, callback, hint, options)
            case "echo":
            default:
                return this.echoExec(cmd, shell, callback, hint, options)
        }
    }

    quickExecute = (cmd, shell) => this.execute(this.config.QUICK_EXEC_SHOW, cmd, shell);
    commitExecute = () => {
        const cmd = this.modal.input.value;
        if (!cmd) {
            this.showStdErr("command is empty");
            return
        }
        const option = this.modal.shellSelect.options[this.modal.shellSelect.selectedIndex];
        const shell = option.value;
        this.showStdout("running...");
        this.execute(this.config.COMMIT_EXEC_SHOW, cmd, shell, null);
    }

    toggleModal = () => {
        const {modal} = this.modal;
        if (this.utils.isShow(modal)) {
            this.utils.hide(modal);
        } else {
            this.utils.show(modal);
            this.modal.input.select();
        }
    }

    call = (type = "show") => {
        if (type === "show") {
            this.toggleModal();
        } else if (type.startsWith(this.arg_value_prefix)) {
            const name = type.slice(this.arg_value_prefix.length);
            const builtin = this.config.BUILTIN.find(builtin => builtin.name === name);
            builtin && this.quickExecute(builtin.cmd, builtin.shell);
        }
    }
}

module.exports = {
    plugin: commanderPlugin
};