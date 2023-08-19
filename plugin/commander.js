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
        #typora-commander {
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
        
        .mac-seamless-mode #typora-commander {
            top: 30px
        }
        
        #typora-commander-form {
            display: flex;
            align-items: center;
            font-size: 14px;
            line-height: 25px;
        }
        
        #typora-commander-form select, input {
            border: 1px solid #ddd;
            box-shadow: inset 0 1px 1px rgba(0, 0, 0, .075);
            border-radius: 2px;
            height: 27px;
            margin-top: 1px;
            margin-bottom: 1px;
        }
                
        #typora-commander-form input {
            width: 60%;
            margin-left: 0;
            margin-right: 2.5px;
            padding-left: 5px;
            padding-right: 24px;
        }

        #typora-commander-form select {
            width: 20%;
            margin-left: 2.5px;
            margin-right: 0;
            padding: 1px 2px;
        }
        
        #typora-commander-form .typora-commander-commit {
            position: absolute;
            padding: 1px;
            left: 335px;
            opacity: 0.7;
            cursor: pointer;
            display: none;
        }

        .typora-commander-output {
            margin-top: 0;
            cursor: default;
            max-height: 340px;
            overflow-y: auto;
            overflow-x: auto;
            display:none;
        }
        
        .typora-commander-output pre {
            display: inline-block;
            font-size: 13px;
            line-height: 1.1;
            margin: 10px 10px 5px 5px;
        }
        
        .typora-commander-output pre.error {
            color: red;
        }

        #typora-commander-form input:focus, pre:focus {
            outline: 0
        }
        `;
        return {textID, text}
    }

    html = () => {
        const windowOption = (File.isMac) ? `` : `
            <option value="${this.SHELL.POWER_SHELL}">powershell</option>
            <option value="${this.SHELL.GIT_BASH}">git bash</option>
            <option value="${this.SHELL.WSL}">wsl</option>`;
        const builtin = this.config.BUILTIN.map(ele => `<option shell="${ele.shell}" value='${ele.cmd}'>${ele.name}</option>`).join("");
        const builtinSelect = !this.config.USE_BUILTIN ? "" : `<select class="typora-commander-builtin">${builtin}</select>`;

        const div = `
        <div id="typora-commander-form">
            <input type="text" class="input" placeholder="Typora commander" autocorrect="off" spellcheck="false"
                autocapitalize="off" data-lg="Front" title="提供如下环境变量:\n$f 当前文件路径\n$d 当前文件所属目录\n$m 当前挂载目录">
            <i class="ion-ios7-play typora-commander-commit" ty-hint="执行命令"></i>
            <select class="typora-commander-shell"><option value="${this.SHELL.CMD_BASH}">cmd/bash</option>${windowOption}</select>
            ${builtinSelect}
        </div>
        <div class="typora-commander-output"><pre tabindex="0"></pre></div>
       `
        const modal = document.createElement("div");
        modal.id = 'typora-commander';
        modal.style.display = "none";
        modal.innerHTML = div;
        const searchPanel = document.getElementById("md-searchpanel");
        searchPanel.parentNode.insertBefore(modal, searchPanel.nextSibling);

        if (!this.config.USE_BUILTIN) {
            document.getElementById('typora-commander').style.width = "500px";
            document.querySelector("#typora-commander-form input").style.width = "80%";
            document.querySelector("#typora-commander-form .typora-commander-commit").style.left = "375px";
        }
    }

    hotkey = () => {
        return [{
            hotkey: this.config.HOTKEY,
            callback: this.call,
        }]
    }

    init = () => {
        this.modal = {
            modal: document.getElementById('typora-commander'),
            input: document.querySelector("#typora-commander-form input"),
            shellSelect: document.querySelector("#typora-commander-form .typora-commander-shell"),
            builtinSelect: document.querySelector("#typora-commander-form .typora-commander-builtin"),
            commit: document.querySelector("#typora-commander-form .typora-commander-commit"),
            output: document.querySelector(".typora-commander-output"),
            pre: document.querySelector(".typora-commander-output pre"),
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
            this.commit();
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
                        this.commit();
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
                    const targetClass = this.config.USE_BUILTIN ? ".typora-commander-builtin" : ".typora-commander-shell";
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
        if (File.isMac) {
            return path
        }
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

    exec = (cmd, shell, resolve, reject) => {
        const _shell = this.getShellCommand(shell);
        const _cmd = this.replaceArgs(cmd, shell);
        this.utils.Package.ChildProcess.exec(
            `chcp 65001 | ${_shell} "${_cmd}"`,
            {
                encoding: 'utf8',
                cwd: this.getFolder(),
            },
            (err, stdout, stderr) => {
                if (err || stderr.length) {
                    reject = reject ? reject : console.error;
                    reject(err || stderr.toString());
                } else {
                    resolve = resolve ? resolve : console.log;
                    resolve(stdout);
                }
            })
    }

    showStdout = stdout => {
        this.modal.output.style.display = "block";
        this.modal.pre.classList.remove("error");
        this.modal.pre.textContent = stdout;
    }

    showStdErr = stderr => {
        this.showStdout(stderr);
        this.modal.pre.classList.add("error");
    }

    silentExec = (cmd, shell) => this.exec(cmd, shell, null, null);
    errorExec = (cmd, shell) => this.exec(cmd, shell, null, this.showStdErr);
    alwaysExec = (cmd, shell) => this.exec(cmd, shell, this.showStdout, this.showStdErr);

    commit = () => {
        const cmd = this.modal.input.value;
        if (!cmd) {
            this.showStdErr("command is empty");
            return
        }
        const option = this.modal.shellSelect.options[this.modal.shellSelect.selectedIndex];
        const shell = option.value;
        this.alwaysExec(cmd, shell);
    }

    quickExec = (cmd, shell) => {
        switch (this.config.QUICK_EXEC_SHOW) {
            case "always":
                return this.alwaysExec(cmd, shell)
            case "error":
                return this.errorExec(cmd, shell)
            case "silent":
                return this.silentExec(cmd, shell)
        }
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
            builtin && this.quickExec(builtin.cmd, builtin.shell);
        }
    }
}

module.exports = {
    plugin: commanderPlugin
};