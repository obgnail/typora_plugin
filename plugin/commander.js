(() => {
    const config = global._pluginUtils.getPluginSetting("commander");
    const SHELL = {
        CMD_BASH: "cmd/bash",
        POWER_SHELL: "powershell",
        GIT_BASH: "gitbash",
        WSL: "wsl",
    };

    (() => {
        const modal_css = `
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
        `
        global._pluginUtils.insertStyle("plugin-commander-style", modal_css);

        const windowOption = (File.isMac) ? `` : `
            <option value="${SHELL.POWER_SHELL}">powershell</option>
            <option value="${SHELL.GIT_BASH}">git bash</option>
            <option value="${SHELL.WSL}">wsl</option>
        `;
        const builtin = config.BUILTIN.map(ele => `<option shell="${ele.shell}" value='${ele.cmd}'>${ele.name}</option>`).join("");
        const builtinSelect = !config.USE_BUILTIN ? "" : `<select class="typora-commander-builtin">${builtin}</select>`;

        const div = `
        <div id="typora-commander-form">
            <input type="text" class="input" placeholder="Typora commander" autocorrect="off" spellcheck="false"
                autocapitalize="off" data-lg="Front" title="提供如下环境变量:\n$f 当前文件路径\n$d 当前文件所属目录\n$m 当前挂载目录">
            <i class="ion-ios7-play typora-commander-commit" ty-hint="执行命令"></i>
            <select class="typora-commander-shell"><option value="${SHELL.CMD_BASH}">cmd/bash</option>${windowOption}</select>
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

        if (!config.USE_BUILTIN) {
            document.getElementById('typora-commander').style.width = "500px";
            document.querySelector("#typora-commander-form input").style.width = "80%";
            document.querySelector("#typora-commander-form .typora-commander-commit").style.left = "375px";
        }
    })()

    const modal = {
        modal: document.getElementById('typora-commander'),
        input: document.querySelector("#typora-commander-form input"),
        shellSelect: document.querySelector("#typora-commander-form .typora-commander-shell"),
        builtinSelect: document.querySelector("#typora-commander-form .typora-commander-builtin"),
        commit: document.querySelector("#typora-commander-form .typora-commander-commit"),
        output: document.querySelector(".typora-commander-output"),
        pre: document.querySelector(".typora-commander-output pre"),
    }

    const convertPath = (path, shell) => {
        if (File.isMac) {
            return path
        }
        switch (shell) {
            case SHELL.WSL:
            case SHELL.GIT_BASH:
                path = path.replace(/\\/g, "/");
                const tempList = path.split(":");
                if (tempList.length !== 2) {
                    return path
                }
                const disk = tempList[0].toLowerCase();
                const remain = tempList[1];
                return (shell === SHELL.GIT_BASH) ? `/${disk}${remain}` : `/mnt/${disk}${remain}`
            case SHELL.CMD_BASH:
            case SHELL.POWER_SHELL:
            default:
                return path
        }
    }

    const getFilePath = global._pluginUtils.getFilePath;
    const getFile = shell => convertPath(getFilePath(), shell);
    const getFolder = shell => convertPath(global._pluginUtils.Package.Path.dirname(getFilePath()), shell);
    const getMountFolder = shell => convertPath(File.getMountFolder(), shell);

    const replaceArgs = (cmd, shell) => {
        const file = getFile(shell);
        const folder = getFolder(shell);
        const mount = getMountFolder(shell);
        cmd = cmd.replace(/\$f/g, `"${file}"`);
        cmd = cmd.replace(/\$d/g, `"${folder}"`);
        cmd = cmd.replace(/\$m/g, `"${mount}"`);
        return cmd
    }

    const getShellCommand = env => {
        switch (env) {
            case SHELL.GIT_BASH:
                return `bash.exe -c`
            case SHELL.POWER_SHELL:
                return `powershell /C`
            case SHELL.WSL:
                return `wsl.exe -e bash -c`
            default:
                return File.isMac ? `bash -c` : `cmd /C`;
        }
    }

    const exec = (cmd, shell, resolve, reject) => {
        const _shell = getShellCommand(shell);
        const _cmd = replaceArgs(cmd, shell);
        global._pluginUtils.Package.ChildProcess.exec(
            `chcp 65001 | ${_shell} "${_cmd}"`,
            {
                encoding: 'utf8',
                cwd: getFolder(),
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

    const showStdout = stdout => {
        modal.output.style.display = "block";
        modal.pre.classList.remove("error");
        modal.pre.textContent = stdout;
    }

    const showStdErr = stderr => {
        showStdout(stderr);
        modal.pre.classList.add("error");
    }

    const silentExec = (cmd, shell) => exec(cmd, shell, null, null);
    const errorExec = (cmd, shell) => exec(cmd, shell, null, showStdErr);
    const alwaysExec = (cmd, shell) => exec(cmd, shell, showStdout, showStdErr);

    const commit = () => {
        const cmd = modal.input.value;
        if (!cmd) {
            showStdErr("command is empty");
            return
        }
        const option = modal.shellSelect.options[modal.shellSelect.selectedIndex];
        const shell = option.value;
        alwaysExec(cmd, shell);
    }

    // 提供不同入口，让鼠标操作的用户不必切换回键盘操作
    modal.commit.addEventListener("click", ev => {
        commit();
        ev.stopPropagation();
        ev.preventDefault();
    }, true);

    modal.input.addEventListener("input", ev => {
        const cmd = modal.input.value.trim();
        if (cmd) {
            modal.commit.style.display = "block";
        } else {
            modal.commit.style.display = "none";
            modal.builtinSelect.value = "";
        }
    })

    modal.shellSelect.addEventListener("change", ev => modal.input.focus());

    modal.modal.addEventListener("keydown", ev => {
        switch (ev.key) {
            case "Enter":
                const input = ev.target.closest("input")
                if (input) {
                    commit();
                    ev.stopPropagation();
                    ev.preventDefault();
                }
                break
            case "Escape":
                ev.stopPropagation();
                ev.preventDefault();
                modal.modal.style.display = "none";
                break
            case "Tab":
                const targetClass = config.USE_BUILTIN ? ".typora-commander-builtin" : ".typora-commander-shell";
                const target = ev.target.closest(targetClass);
                if (target) {
                    ev.stopPropagation();
                    ev.preventDefault();
                    modal.input.focus();
                }
                break
        }
    })

    if (config.USE_BUILTIN) {
        modal.builtinSelect.addEventListener("change", ev => {
            const option = modal.builtinSelect.options[modal.builtinSelect.selectedIndex];
            modal.shellSelect.value = option.getAttribute("shell");
            modal.input.value = option.value;
            modal.input.dispatchEvent(new CustomEvent('input'));
            modal.input.focus();
        })
    }

    if (config.ALLOW_DRAG) {
        global._pluginUtils.dragFixedModal(modal.input, modal.modal);
    }

    const arg_value_prefix = "call_builtin-";

    const quickExec = (cmd, shell) => {
        switch (config.QUICK_EXEC_SHOW) {
            case "always":
                return alwaysExec(cmd, shell)
            case "error":
                return errorExec(cmd, shell)
            case "silent":
                return silentExec(cmd, shell)
        }
    }

    const callArgs = []
    config.BUILTIN.forEach(builtin => {
        if (builtin.name) {
            callArgs.push({
                arg_name: `${builtin.name}`,
                arg_value: arg_value_prefix + builtin.name
            })
        }
    });

    const call = (type = "show") => {
        if (type === "show") {
            if (modal.modal.style.display === "block") {
                modal.modal.style.display = "none";
            } else {
                modal.modal.style.display = "block";
                modal.input.select();
            }
        } else if (type.startsWith(arg_value_prefix)) {
            const name = type.slice(arg_value_prefix.length);
            const builtin = config.BUILTIN.find(builtin => builtin.name === name);
            builtin && quickExec(builtin.cmd, builtin.shell);
        }
    }

    global._pluginUtils.registerWindowHotkey(config.HOTKEY, call);

    module.exports = {
        call,
        callArgs
    };

    console.log("commander.js had been injected");
})()