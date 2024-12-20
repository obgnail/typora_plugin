/**
 * 实现此插件需要三种兼容:
 * 1. 抹平操作系统差异，支持windows和linux
 * 2. 抹平shell差异，支持cmd、wsl和bash，支持嵌套调用shell
 * 3. 抹平参数差异，cmd使用%VAR%，而bash使用$VAR
 */
class commanderPlugin extends BasePlugin {
    beforeProcess = () => {
        this.SHELL = { CMD_BASH: "cmd/bash", POWER_SHELL: "powershell", GIT_BASH: "gitbash", WSL: "wsl" }
        const shellList = Object.values(this.SHELL)
        this.builtin = this.config.BUILTIN.filter(e => !e.disable && e.shell && shellList.includes(e.shell))
        if (!File.isWin) {
            this.builtin = this.builtin.filter(e => e.shell !== this.SHELL.CMD_BASH)
        }
    }

    styleTemplate = () => true

    html = () => {
        const { CMD_BASH, POWER_SHELL, GIT_BASH, WSL } = this.SHELL
        const genShell = (shell, text) => `<option value="${shell}">${text}</option>`
        const shells = [genShell(CMD_BASH, "cmd/bash")]
        if (File.isWin) {
            shells.push(
                genShell(POWER_SHELL, "PowerShell"),
                genShell(GIT_BASH, "Git Bash"),
                genShell(WSL, "WSL"),
            )
        }
        const builtin = this.builtin.map(e => `<option data-shell="${e.shell}" value="${this.utils.escape(e.cmd)}">${e.name}</option>`).join("")
        return `
            <div id="plugin-commander" class="plugin-common-modal plugin-common-hidden"> 
                <form id="plugin-commander-form">
                    <div class="ion-ios7-play plugin-commander-commit plugin-common-hidden" ty-hint="执行命令"></div>
                    <input type="text" class="plugin-commander-input" placeholder="Typora commander" title="提供如下环境变量:\n$f 当前文件路径\n$d 当前文件所属目录\n$m 当前挂载目录">
                    <select class="plugin-commander-shell">${shells.join("")}</select>
                    <select class="plugin-commander-builtin">${builtin}</select>
                </form>
                <div class="plugin-commander-output plugin-common-hidden"><pre></pre></div>
            </div>
        `
    }

    hotkey = () => {
        const defaultHotkey = { hotkey: this.config.HOTKEY, callback: this.call }
        const customHotkeys = this.builtin
            .filter(({ hotkey, cmd }) => hotkey && cmd)
            .map(({ hotkey, cmd, shell }) => ({ hotkey, callback: () => this.quickExecute(cmd, shell) }))
        return [defaultHotkey, ...customHotkeys]
    }

    init = () => {
        this.entities = {
            modal: document.getElementById("plugin-commander"),
            form: document.querySelector("#plugin-commander-form"),
            input: document.querySelector("#plugin-commander-form .plugin-commander-input"),
            shellSelect: document.querySelector("#plugin-commander-form .plugin-commander-shell"),
            builtinSelect: document.querySelector("#plugin-commander-form .plugin-commander-builtin"),
            commit: document.querySelector("#plugin-commander-form .plugin-commander-commit"),
            output: document.querySelector(".plugin-commander-output"),
            pre: document.querySelector(".plugin-commander-output pre"),
        }

        this.arg_value_prefix = "call_builtin@"
        const defaultArg = { arg_name: "显示/隐藏", arg_value: "show", arg_hotkey: this.config.HOTKEY }
        const customArgs = this.builtin
            .filter(builtin => builtin.name)
            .map(builtin => ({ arg_name: builtin.name, arg_value: this.arg_value_prefix + builtin.name, arg_hotkey: builtin.hotkey }))
        this.callArgs = [defaultArg, ...customArgs]
    }

    process = () => {
        this.entities.commit.addEventListener("click", () => this.commitExecute());
        this.entities.shellSelect.addEventListener("change", () => this.entities.input.focus());
        this.entities.builtinSelect.addEventListener("change", ev => {
            const option = ev.target.selectedOptions[0];
            if (!option) return;
            this.entities.shellSelect.value = option.dataset.shell;
            this.entities.input.value = option.value;
            this.entities.input.dispatchEvent(new Event("input"));
            this.entities.input.focus();
        })
        this.entities.input.addEventListener("input", ev => {
            const hasCMD = ev.target.value.trim();
            this.utils.toggleVisible(this.entities.commit, !hasCMD);
            if (!hasCMD) {
                this.entities.builtinSelect.value = "";
            }
        })
        this.entities.form.addEventListener("submit", ev => {
            ev.preventDefault();
            this.commitExecute();
        })
        this.entities.form.addEventListener("keydown", ev => {
            const wantHide = ev.key === "Escape" || (ev.key === "Backspace" && this.config.BACKSPACE_TO_HIDE && !this.entities.input.value);
            wantHide && this.utils.hide(this.entities.modal);
        });
        if (this.config.ALLOW_DRAG) {
            this.utils.dragFixedModal(this.entities.input, this.entities.modal);
        }
    }

    _convertPath = (path, shell) => {
        if (!File.isWin) return path;

        if (shell === this.SHELL.WSL) {
            return '/mnt' + this.utils.windowsPathToUnix(path);
        } else if (shell === this.SHELL.GIT_BASH) {
            return this.utils.windowsPathToUnix(path);
        }

        return path;
    }
    _getFile = shell => this._convertPath(this.utils.getFilePath(), shell);
    _getFolder = shell => this._convertPath(this.utils.getCurrentDirPath(), shell);
    _getMountFolder = shell => this._convertPath(this.utils.getMountFolder(), shell);

    // TODO: 这种做法路子太野，正确方式应该是：反弹shell
    _getCommand = (cmd, shell) => {
        const replaceArgs = (cmd, shell) => {
            const replacements = { f: this._getFile(shell), d: this._getFolder(shell), m: this._getMountFolder(shell) }
            return cmd.replace(/\$([fdm])\b/g, match => `"${replacements[match.slice(1)]}"`)
        }
        const getShellCommand = shell => {
            switch (shell) {
                case this.SHELL.GIT_BASH:
                    return `bash.exe -c`
                case this.SHELL.POWER_SHELL:
                    return `powershell /C`
                case this.SHELL.WSL:
                    return `wsl.exe -e bash -c`
                default:
                    return File.isWin ? "cmd /C" : "bash -c"
            }
        }
        const prefix = File.isWin ? "chcp 65001 |" : ""
        const nestCommand = replaceArgs(cmd, shell)
        const shellCommand = getShellCommand(shell)
        return `${prefix} ${shellCommand} "${nestCommand}"`
    }

    _refreshModal = (cmd, shell) => {
        this.entities.input.value = cmd;
        this.entities.input.dispatchEvent(new Event("input"));
        this.entities.shellSelect.value = shell;
        this._showResult("", false, false);
    }

    _showResult = (result, showModal = true, error = false) => {
        if (showModal) {
            this.utils.show(this.entities.modal);
        }
        this.utils.show(this.entities.output);
        this.entities.pre.textContent = result;
        this.entities.pre.classList.toggle("error", error);
    }
    _showStdout = result => this._showResult(result, true, false)
    _showStderr = result => this._showResult(result, true, true)

    // 为什么不使用shell options? 答：不能支持wsl
    // 为什么不使用env options?   答：为了兼容。cmd使用变量的方式为%VAR%，bash为$VAR。而且命令可能会跨越多层shell
    _exec = ({ cmd, shell, options = {}, resolve = console.log, reject = console.error, callback = null }) => {
        const command = this._getCommand(cmd, shell);
        const options_ = { encoding: "utf8", cwd: this._getFolder(), ...options }
        const callback_ = (err, stdout, stderr) => {
            if (err || stderr.length) {
                reject && reject(err || stderr.toString());
            } else {
                resolve && resolve(stdout);
            }
            callback && callback(err, stdout, stderr);
        }

        this._refreshModal(cmd, shell);
        this.utils.Package.ChildProcess.exec(command, options_, callback_);
    }
    _spawn = ({ cmd, shell, options = {}, callback = null }) => {
        const command = this._getCommand(cmd, shell);
        const options_ = { encoding: "utf8", cwd: this._getFolder(), shell: true, ...options };
        const resolve = data => this.entities.pre.textContent += data.toString();
        const reject = data => {
            this.entities.pre.textContent += data.toString();
            this.entities.pre.classList.add("error");
        }
        const callback_ = code => callback && callback(code);

        this._refreshModal(cmd, shell);
        const child = this.utils.Package.ChildProcess.spawn(command, options_);
        child.stdout.on("data", resolve);
        child.stderr.on("data", reject);
        child.on("close", callback_);
    }

    echoExec = (cmd, shell, options = {}, callback = null) => this._spawn({ cmd, shell, options, callback });
    silentExec = (cmd, shell, options = {}, callback = null) => this._exec({ cmd, shell, options, callback });
    errorExec = (cmd, shell, options = {}, callback = null) => this._exec({ cmd, shell, options, callback, reject: this._showStderr });
    alwaysExec = (cmd, shell, options = {}, callback = null) => this._exec({ cmd, shell, options, callback, resolve: this._showStdout, reject: this._showStderr });

    execute = (type, cmd, shell, options = {}, callback = null) => {
        const execFunctions = { always: this.alwaysExec, error: this.errorExec, silent: this.silentExec, echo: this.echoExec };
        const execFunction = execFunctions[type] || execFunctions.echo;
        return execFunction(cmd, shell, options, callback);
    };
    quickExecute = (cmd, shell) => this.execute(this.config.QUICK_EXEC_SHOW, cmd, shell);
    commitExecute = () => {
        const cmd = this.entities.input.value;
        if (!cmd) {
            this._showStderr("command is empty");
        } else {
            const option = this.entities.shellSelect.selectedOptions[0];
            option && this.execute(this.config.COMMIT_EXEC_SHOW, cmd, option.value);
        }
    }

    toggleModal = () => {
        const { modal, input } = this.entities;
        this.utils.toggleVisible(modal);
        if (this.utils.isShow(modal)) {
            input.select();
        }
    }

    call = (type = "show") => {
        if (type === "show") {
            this.toggleModal()
        } else if (type.startsWith(this.arg_value_prefix)) {
            const name = type.slice(this.arg_value_prefix.length)
            const builtin = this.builtin.find(c => c.name === name)
            builtin && this.quickExecute(builtin.cmd, builtin.shell)
        }
    }
}

module.exports = {
    plugin: commanderPlugin
}