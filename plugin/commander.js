class commanderPlugin extends BasePlugin {
    beforeProcess = () => {
        this.SHELL = {CMD_BASH: "cmd/bash", POWER_SHELL: "powershell", GIT_BASH: "gitbash", WSL: "wsl"};
    }

    styleTemplate = () => true

    htmlTemplate = () => {
        const shellChildren = [{ele: "option", value: this.SHELL.CMD_BASH, text: "cmd/bash"}];
        if (File.isWin) {
            shellChildren.push(
                {ele: "option", value: this.SHELL.POWER_SHELL, text: "PowerShell"},
                {ele: "option", value: this.SHELL.GIT_BASH, text: "Git Bash"},
                {ele: "option", value: this.SHELL.WSL, text: "WSL"},
            )
        }

        const hint = "提供如下环境变量:\n$f 当前文件路径\n$d 当前文件所属目录\n$m 当前挂载目录";
        const formChildren = [
            {ele: "input", type: "text", placeholder: "Typora commander", title: hint},
            {ele: "i", class_: "ion-ios7-play plugin-commander-commit", "ty-hint": "执行命令"},
            {ele: "select", class_: "plugin-commander-shell", children: shellChildren}
        ]

        if (this.config.USE_BUILTIN) {
            const builtin = this.config.BUILTIN.map(e => ({ele: "option", shell: e.shell, value: e.cmd, text: e.name}));
            formChildren.push({ele: "select", class_: "plugin-commander-builtin", children: builtin});
        }

        const children = [
            {id: "plugin-commander-form", children: formChildren},
            {class_: "plugin-commander-output", children: [{ele: "pre", tabindex: "0"}]}
        ]
        return [{id: "plugin-commander", class_: "plugin-common-modal", style: {display: "none"}, children}]
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
        this.init();

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
                this.modal.commit.style.display = "block";
            } else {
                this.modal.commit.style.display = "none";
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
                        this.modal.modal.style.display = "none";
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
    getMountFolder = shell => this.convertPath(File.getMountFolder(), shell);

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

    beforeExecute = (cmd, shell, hint) => {
        this.modal.input.value = cmd;
        this.modal.shellSelect.value = shell;
        this.modal.commit.style.display = "block";
        typeof hint === "string" && this.showStdout(hint);

        const shell_ = this.getShellCommand(shell);
        const cmd_ = this.replaceArgs(cmd, shell);
        return {shell_, cmd_}
    }

    showStdout = stdout => {
        this.modal.modal.style.display = "block";
        this.modal.output.style.display = "block";
        this.modal.pre.classList.remove("error");
        this.modal.pre.textContent = stdout;
    }

    showStdErr = stderr => {
        this.showStdout(stderr);
        this.modal.pre.classList.add("error");
    }

    // 为什么不使用shell options? 答：不能支持wsl
    // 为什么不使用env options?   答：为了兼容。cmd使用变量的方式为%VAR%，bash为$VAR。而且命令可能会跨越多层shell
    exec = (cmd, shell, resolve, reject, callback, hint, options = {}) => {
        resolve = resolve || console.log;
        reject = reject || console.error;
        const cb = (err, stdout, stderr) => callback && callback(err, stdout, stderr);

        const prefix = File.isWin ? `chcp 65001 |` : "";
        const {cmd_, shell_} = this.beforeExecute(cmd, shell, hint);
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

    spawn = (cmd, shell, resolve, reject, callback, hint, options = {}) => {
        resolve = resolve || console.log;
        reject = reject || console.error;
        const cb = code => callback && callback(code);

        const prefix = File.isWin ? "chcp 65001 |" : "";
        const {cmd_, shell_} = this.beforeExecute(cmd, shell, hint || ""); // 执行前清空输出
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
        if (this.modal.modal.style.display === "block") {
            this.modal.modal.style.display = "none";
        } else {
            this.modal.modal.style.display = "block";
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