/**
 * 实现此插件需要三种兼容:
 * 1. 抹平操作系统差异，支持windows和linux
 * 2. 抹平shell差异，支持cmd、wsl和bash，支持嵌套调用shell
 * 3. 抹平参数差异，cmd使用%VAR%，而bash使用$VAR
 */
class commanderPlugin extends BasePlugin {
    beforeProcess = () => {
        this.SHELL = { CMD_BASH: "cmd/bash", POWER_SHELL: "powershell", GIT_BASH: "gitbash", WSL: "wsl" };
    }

    styleTemplate = () => true

    html = () => {
        const { CMD_BASH, POWER_SHELL, GIT_BASH, WSL } = this.SHELL;
        const genShell = (shell, text) => `<option value="${shell}">${text}</option>`;
        const shells = [genShell(CMD_BASH, "cmd/bash")];
        if (File.isWin) {
            shells.push(
                genShell(POWER_SHELL, "PowerShell"),
                genShell(GIT_BASH, "Git Bash"),
                genShell(WSL, "WSL"),
            )
        }

        let builtinSelect = "";
        const builtin = this.config.BUILTIN.map(e => `<option shell="${e.shell}" value="${this.utils.escape(e.cmd)}">${e.name}</option>`).join("");
        builtinSelect = `<select class="plugin-commander-builtin">${builtin}</select>`;

        return `
            <div id="plugin-commander" class="plugin-common-modal plugin-common-hidden"> 
                <div id="plugin-commander-form">
                    <i class="ion-ios7-play plugin-commander-commit plugin-common-hidden" ty-hint="执行命令"></i>
                    <input type="text" class="plugin-commander-input" placeholder="Typora commander" title="提供如下环境变量:\n$f 当前文件路径\n$d 当前文件所属目录\n$m 当前挂载目录"/>
                    <select class="plugin-commander-shell">${shells.join("")}</select>
                    ${builtinSelect}
                </div>
                <div class="plugin-commander-output plugin-common-hidden"><pre tabindex="0"></pre></div>
            </div>
        `
    }

    hotkey = () => {
        const { HOTKEY, BUILTIN = [] } = this.config;
        const defaultHotkey = { hotkey: HOTKEY, callback: this.call };
        const customHotkeys = BUILTIN
            .filter(({ hotkey, cmd, shell }) => hotkey && cmd && shell)
            .map(({ hotkey, cmd, shell }) => ({ hotkey, callback: () => this.quickExecute(cmd, shell) }));
        return [defaultHotkey, ...customHotkeys];
    }

    init = () => {
        this.entities = {
            modal: document.getElementById("plugin-commander"),
            input: document.querySelector("#plugin-commander-form .plugin-commander-input"),
            shellSelect: document.querySelector("#plugin-commander-form .plugin-commander-shell"),
            builtinSelect: document.querySelector("#plugin-commander-form .plugin-commander-builtin"),
            commit: document.querySelector("#plugin-commander-form .plugin-commander-commit"),
            output: document.querySelector(".plugin-commander-output"),
            pre: document.querySelector(".plugin-commander-output pre"),
        }

        this.arg_value_prefix = "call_builtin@";
        const defaultArg = { arg_name: "显示/隐藏", arg_value: "show", arg_hotkey: this.config.HOTKEY };
        const customArgs = this.config.BUILTIN
            .filter(builtin => builtin.name)
            .map(builtin => ({ arg_name: builtin.name, arg_value: this.arg_value_prefix + builtin.name, arg_hotkey: builtin.hotkey }))
        this.callArgs = [defaultArg, ...customArgs];
    }

    process = () => {
        // 提供不同入口，让鼠标操作的用户不必切换回键盘操作
        this.entities.commit.addEventListener("click", ev => {
            this.commitExecute();
            ev.stopPropagation();
            ev.preventDefault();
        }, true);

        this.entities.input.addEventListener("input", () => {
            const cmd = this.entities.input.value.trim();
            if (cmd) {
                this.utils.show(this.entities.commit);
            } else {
                this.utils.hide(this.entities.commit);
                this.entities.builtinSelect.value = "";
            }
        })

        this.entities.modal.addEventListener("keydown", ev => {
            const { key, target } = ev;
            const isEnter = key === "Enter" && target.closest("input");
            const isEscape = key === "Escape" || (key === "Backspace" && this.config.BACKSPACE_TO_HIDE && !this.entities.input.value);
            const isTab = key === "Tab" && target.closest(".plugin-commander-builtin");

            if (isEnter) {
                this.commitExecute();
            } else if (isEscape) {
                this.utils.hide(this.entities.modal);
            } else if (isTab) {
                this.entities.input.focus();
            }

            if (isEnter || isEscape || isTab) {
                ev.stopPropagation();
                ev.preventDefault();
            }
        });

        this.entities.shellSelect.addEventListener("change", () => this.entities.input.focus());

        this.entities.builtinSelect.addEventListener("change", () => {
            const option = this.entities.builtinSelect.options[this.entities.builtinSelect.selectedIndex];
            this.entities.shellSelect.value = option.getAttribute("shell");
            this.entities.input.value = option.value;
            this.entities.input.dispatchEvent(new CustomEvent('input'));
            this.entities.input.focus();
        })

        if (this.config.ALLOW_DRAG) {
            this.utils.dragFixedModal(this.entities.input, this.entities.modal);
        }
    }

    convertPath = (path, shell) => {
        if (!File.isWin) return path;

        if (shell === this.SHELL.WSL) {
            return '/mnt' + this.utils.windowsPathToUnix(path);
        } else if (shell === this.SHELL.GIT_BASH) {
            return this.utils.windowsPathToUnix(path);
        }

        return path;
    }

    getFile = shell => this.convertPath(this.utils.getFilePath(), shell);
    getFolder = shell => this.convertPath(this.utils.getCurrentDirPath(), shell);
    getMountFolder = shell => this.convertPath(this.utils.getMountFolder(), shell);

    replaceArgs = (cmd, shell) => {
        const file = this.getFile(shell);
        const folder = this.getFolder(shell);
        const mount = this.getMountFolder(shell);
        return cmd.replace(/\$f/g, `"${file}"`).replace(/\$d/g, `"${folder}"`).replace(/\$m/g, `"${mount}"`);
    }

    // TODO: 这种做法路子太野，应该采用【反弹shell】
    getShellCommand = env => {
        switch (env) {
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

    normalizeModal = (cmd, shell, hint) => {
        this.entities.input.value = cmd;
        this.entities.shellSelect.value = shell;
        this.utils.show(this.entities.commit);
        typeof hint === "string" && this.showStdout(hint);
    }

    normalizeCommand = (cmd, shell) => {
        cmd = this.replaceArgs(cmd, shell);
        shell = this.getShellCommand(shell);
        return [cmd, shell]
    }

    showStdout = stdout => {
        this.utils.show(this.entities.modal);
        this.utils.show(this.entities.output);
        this.entities.pre.classList.remove("error");
        this.entities.pre.textContent = stdout;
    }

    showStdErr = stderr => {
        this.showStdout(stderr);
        this.entities.pre.classList.add("error");
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
        const defaultOptions = { encoding: 'utf8', cwd: this.getFolder() };
        const option_ = { ...defaultOptions, ...options };
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
        const defaultOptions = { encoding: 'utf8', cwd: this.getFolder(), shell: true };
        const option_ = { ...defaultOptions, ...options };
        const child = this.utils.Package.ChildProcess.spawn(command_, option_);
        child.stdout.on('data', resolve);
        child.stderr.on("data", reject);
        child.on('close', cb);
    }

    silentExec = (cmd, shell, callback, hint, options) => this.exec(cmd, shell, null, null, callback, hint, options);
    errorExec = (cmd, shell, callback, hint, options) => this.exec(cmd, shell, null, this.showStdErr, callback, hint, options);
    alwaysExec = (cmd, shell, callback, hint, options) => this.exec(cmd, shell, this.showStdout, this.showStdErr, callback, hint, options);
    echoExec = (cmd, shell, callback, hint, options) => {
        const resolve = data => this.entities.pre.textContent += data.toString();
        const addErrorClass = this.utils.once(() => this.entities.pre.classList.add("error"));
        const reject = data => {
            this.entities.pre.textContent += data.toString();
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
        const cmd = this.entities.input.value;
        if (!cmd) {
            this.showStdErr("command is empty");
            return
        }
        const option = this.entities.shellSelect.options[this.entities.shellSelect.selectedIndex];
        const shell = option.value;
        this.showStdout("running...");
        this.execute(this.config.COMMIT_EXEC_SHOW, cmd, shell, null);
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