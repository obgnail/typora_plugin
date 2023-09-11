class commanderPlugin extends global._basePlugin {
    beforeProcess() {
        this.SHELL = {
            CMD_BASH: "cmd/bash",
            POWER_SHELL: "powershell",
            GIT_BASH: "gitbash",
            WSL: "wsl",
        };
    }

    style = () => {
        const textID = "plugin-commander-style"
        const text = `
        #plugin-commander {
            position: fixed;
            top: 30%;
            left: 55%;
            width: 600px;
            z-index: 9999;
            padding: 4px;
            background-color: #f8f8f8;
            box-shadow: 0 4px 10px rgba(0, 0, 0, .5);
            border: 1px solid #ddd;
            border-top: none;
            color: var(--text-color);
            transform: translate3d(0, 0, 0)
        }
        
        .mac-seamless-mode #plugin-commander {
            top: 30px
        }
        
        #plugin-commander-form {
            display: flex;
            align-items: center;
            font-size: 14px;
            line-height: 25px;
        }
        
        #plugin-commander-form select, input {
            border: 1px solid #ddd;
            box-shadow: inset 0 1px 1px rgba(0, 0, 0, .075);
            border-radius: 2px;
            height: 27px;
            margin-top: 1px;
            margin-bottom: 1px;
        }
                
        #plugin-commander-form input {
            width: 60%;
            margin-left: 0;
            margin-right: 2.5px;
            padding-left: 5px;
            padding-right: 24px;
        }

        #plugin-commander-form select {
            width: 20%;
            margin-left: 2.5px;
            margin-right: 0;
            padding: 1px 2px;
        }
        
        #plugin-commander-form .plugin-commander-commit {
            position: absolute;
            padding: 1px;
            left: 335px;
            opacity: 0.7;
            cursor: pointer;
            display: none;
        }

        .plugin-commander-output {
            margin-top: 0;
            cursor: default;
            max-height: 340px;
            overflow-y: auto;
            overflow-x: auto;
            display:none;
        }
        
        .plugin-commander-output pre {
            display: inline-block;
            font-size: 13px;
            line-height: 1.1;
            margin: 10px 10px 5px 5px;
        }
        
        .plugin-commander-output pre.error {
            color: red;
        }

        #plugin-commander-form input:focus, pre:focus {
            outline: 0
        }
        `;
        return {textID, text}
    }

    html = () => {
        const windowOption = (File.isMac) ? `` : `
            <option value="${this.SHELL.POWER_SHELL}">PowerShell</option>
            <option value="${this.SHELL.GIT_BASH}">Git Bash</option>
            <option value="${this.SHELL.WSL}">WSL</option>`;
        const builtin = this.config.BUILTIN.map(ele => `<option shell="${ele.shell}" value='${ele.cmd}'>${ele.name}</option>`).join("");
        const builtinSelect = !this.config.USE_BUILTIN ? "" : `<select class="plugin-commander-builtin">${builtin}</select>`;

        const div = `
        <div id="plugin-commander-form">
            <input type="text" class="input" placeholder="Typora commander" autocorrect="off" spellcheck="false"
                autocapitalize="off" data-lg="Front" title="提供如下环境变量:\n$f 当前文件路径\n$d 当前文件所属目录\n$m 当前挂载目录">
            <i class="ion-ios7-play plugin-commander-commit" ty-hint="执行命令"></i>
            <select class="plugin-commander-shell"><option value="${this.SHELL.CMD_BASH}">cmd/bash</option>${windowOption}</select>
            ${builtinSelect}
        </div>
        <div class="plugin-commander-output"><pre tabindex="0"></pre></div>
       `
        const modal = document.createElement("div");
        modal.id = 'plugin-commander';
        modal.style.display = "none";
        modal.innerHTML = div;
        this.utils.insertDiv(modal);

        if (!this.config.USE_BUILTIN) {
            document.getElementById('plugin-commander').style.width = "500px";
            document.querySelector("#plugin-commander-form input").style.width = "80%";
            document.querySelector("#plugin-commander-form .plugin-commander-commit").style.left = "375px";
        }
    }

    hotkey = () => {
        const hotkeys = [{hotkey: this.config.HOTKEY, callback: this.call}];
        if (this.config.USE_BUILTIN) {
            this.config.BUILTIN.forEach(ele => {
                if (ele["hotkey"] && ele["cmd"] && ele["shell"]) {
                    hotkeys.push({hotkey: ele["hotkey"], callback: () => this.quickExecute(ele["cmd"], ele["shell"])});
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

        this.arg_value_prefix = "call_builtin-";
        this.callArgs = [{arg_name: "显示/隐藏", arg_value: "show"}];
        this.config.BUILTIN.forEach(builtin => {
            if (builtin.name) {
                this.callArgs.push({
                    arg_name: `${builtin.name}`,
                    arg_value: this.arg_value_prefix + builtin.name
                })
            }
        });
    }

    process = () => {
        this.init();

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
                    ev.stopPropagation();
                    ev.preventDefault();
                    this.modal.modal.style.display = "none";
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
        if (File.isMac) return path

        switch (shell) {
            case this.SHELL.WSL:
            case this.SHELL.GIT_BASH:
                path = path.replace(/\\/g, "/");
                const tempList = path.split(":");
                if (tempList.length !== 2) {
                    return path
                }
                const disk = tempList[0].toLowerCase();
                const remain = tempList[1];
                return (shell === this.SHELL.GIT_BASH) ? `/${disk}${remain}` : `/mnt/${disk}${remain}`
            case this.SHELL.CMD_BASH:
            case this.SHELL.POWER_SHELL:
            default:
                return path
        }
    }

    getFilePath = this.utils.getFilePath;
    getFile = shell => this.convertPath(this.getFilePath(), shell);
    getFolder = shell => this.convertPath(this.utils.Package.Path.dirname(this.getFilePath()), shell);
    getMountFolder = shell => this.convertPath(File.getMountFolder(), shell);

    replaceArgs = (cmd, shell) => {
        const file = this.getFile(shell);
        const folder = this.getFolder(shell);
        const mount = this.getMountFolder(shell);
        cmd = cmd.replace(/\$f/g, `"${file}"`);
        cmd = cmd.replace(/\$d/g, `"${folder}"`);
        cmd = cmd.replace(/\$m/g, `"${mount}"`);
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
                return File.isMac ? `bash -c` : `cmd /C`;
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

    exec = (cmd, shell, resolve, reject, callback, hint) => {
        const {cmd_, shell_} = this.beforeExecute(cmd, shell, hint);
        this.utils.Package.ChildProcess.exec(
            `chcp 65001 | ${shell_} "${cmd_}"`,
            {
                encoding: 'utf8',
                cwd: this.getFolder(),
            },
            (err, stdout, stderr) => {
                if (err || stderr.length) {
                    reject = reject || console.error;
                    reject(err || stderr.toString());
                } else {
                    resolve = resolve || console.log;
                    resolve(stdout);
                }
                callback && callback(err, stdout, stderr);
            }
        )
    }

    silentExec = (cmd, shell, callback, hint) => this.exec(cmd, shell, null, null, callback, hint);
    errorExec = (cmd, shell, callback, hint) => this.exec(cmd, shell, null, this.showStdErr, callback, hint);
    alwaysExec = (cmd, shell, callback, hint) => this.exec(cmd, shell, this.showStdout, this.showStdErr, callback, hint);
    echoExec = (cmd, shell, callback, hint) => {
        let once = true;
        const {cmd_, shell_} = this.beforeExecute(cmd, shell, hint || ""); // 执行前清空输出

        const child = this.utils.Package.ChildProcess.spawn(
            `chcp 65001 | ${shell_} "${cmd_}"`,
            {
                encoding: 'utf8',
                cwd: this.getFolder(),
                shell: true,
            },
        );
        child.stdout.on('data', data => this.modal.pre.textContent += data.toString());
        child.stderr.on("data", data => {
            this.modal.pre.textContent += data.toString();
            if (once) {
                this.modal.pre.classList.add("error");
                once = false;
            }
        });
        child.on('close', code => callback && callback(code));
    }

    execute = (type, cmd, shell, callback, hint) => {
        switch (type) {
            case "always":
                return this.alwaysExec(cmd, shell, callback, hint)
            case "error":
                return this.errorExec(cmd, shell, callback, hint)
            case "silent":
                return this.silentExec(cmd, shell, callback, hint)
            case "echo":
            default:
                return this.echoExec(cmd, shell, callback, hint)
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

    call = (type = "show") => {
        if (type === "show") {
            if (this.modal.modal.style.display === "block") {
                this.modal.modal.style.display = "none";
            } else {
                this.modal.modal.style.display = "block";
                this.modal.input.select();
            }
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