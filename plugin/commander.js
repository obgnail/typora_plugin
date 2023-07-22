(() => {
    const SHELL = {
        CMD_BASH: "cmd/bash",
        POWER_SHELL: "powershell",
        GIT_BASH: "gitbash",
        WSL: "wsl",
    }

    const config = {
        // 快捷键
        HOTKEY: ev => metaKeyPressed(ev) && ev.key === "g",
        // 允许拖动模态框
        ALLOW_DRAG: true,
        // 启用内建的命令列表
        USE_BUILTIN: true,
        // 内建命令列表
        BUILTIN: [
            {name: "", shell: SHELL.CMD_BASH, cmd: ""}, // dummy
            {name: "Explorer", shell: SHELL.POWER_SHELL, cmd: "explorer $d"},
            {name: "Vscode", shell: SHELL.CMD_BASH, cmd: "code $f"},
            {name: "WT", shell: SHELL.CMD_BASH, cmd: "cd $d && wt"},
            {name: "GitCommit", shell: SHELL.CMD_BASH, cmd: `cd $m && git add . && git commit -m "message"`},
        ],
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
            padding-right: 5px;
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
        }

        .typora-commander-output {
            margin-top: 0;
            cursor: default;
            max-height: 340px;
            overflow-y: auto;
            overflow-x: auto;
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
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = modal_css;
        document.getElementsByTagName("head")[0].appendChild(style);

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
            <i class="ion-ios7-play typora-commander-commit" ty-hint="执行命令" style="display: none"></i>
            <select class="typora-commander-shell"><option value="${SHELL.CMD_BASH}">cmd/bash</option>${windowOption}</select>
            ${builtinSelect}
        </div>
        <div class="typora-commander-output" id="typora-commander-output" style="display:none"><pre tabindex="0"></pre></div>
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
        output: document.querySelector("#typora-commander-output"),
        pre: document.querySelector("#typora-commander-output pre")
    }

    const Package = {
        child_process: reqnode('child_process'),
        path: reqnode('path'),
    };

    const metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey

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

    const _getFile = () => File.filePath || (File.bundle && File.bundle.filePath);
    const getFile = shell => convertPath(_getFile(), shell);
    const getFolder = shell => convertPath(Package.path.dirname(_getFile()), shell);
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
        Package.child_process.exec(
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

    const commit = ev => {
        ev.stopPropagation();
        ev.preventDefault();
        const cmd = modal.input.value;
        if (!cmd) {
            showStdErr("command is empty");
            return
        }
        const option = modal.shellSelect.options[modal.shellSelect.selectedIndex];
        const shell = option.value;
        exec(cmd, shell, showStdout, showStdErr);
    }

    // 提供不同入口，让鼠标操作的用户不必切换回键盘操作
    modal.commit.addEventListener("click", ev => commit(ev), true);

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
                    commit(ev);
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

    window.addEventListener("keydown", ev => {
        if (config.HOTKEY(ev)) {
            modal.modal.style.display = "block";
            modal.input.select();
            ev.preventDefault();
            ev.stopPropagation();
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
        modal.input.addEventListener("mousedown", ev => {
            ev.stopPropagation();
            const rect = modal.modal.getBoundingClientRect();
            const shiftX = ev.clientX - rect.left;
            const shiftY = ev.clientY - rect.top;

            const onMouseMove = ev => {
                ev.stopPropagation();
                ev.preventDefault();
                requestAnimationFrame(() => {
                    modal.modal.style.left = ev.clientX - shiftX + 'px';
                    modal.modal.style.top = ev.clientY - shiftY + 'px';
                });
            }

            document.addEventListener("mouseup", ev => {
                    ev.stopPropagation();
                    ev.preventDefault();
                    document.removeEventListener('mousemove', onMouseMove);
                    modal.modal.onmouseup = null;
                }
            )

            document.addEventListener('mousemove', onMouseMove);
        })
        modal.input.ondragstart = () => false
    }

    console.log("commander.js had been injected");
})()