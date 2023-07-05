(() => {
    const config = {
        ENABLE: true,
        ALLOW_DRAG: true,
        WSL_DISTRIBUTION: "Ubuntu-16.04",
        HOTKEY: ev => metaKeyPressed(ev) && ev.key.toLowerCase() === "g",

        DEBUG: false
    }

    if (!config.ENABLE) {
        return
    }

    const SHELL = {
        BASH: "bash",
        CMD: "cmd",
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
            width: 500px;
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
        
        #typora-commander-form select,input {
            border: 1px solid #ddd;
            box-shadow: inset 0 1px 1px rgba(0, 0, 0, .075);
            border-radius: 2px;
            height: 27px;
            margin-top: 1px;
            margin-bottom: 1px;
        }
        
        #typora-commander-form select {
            width: 20%;
            margin-left: 2.5px;
            margin-right: 0;
            padding: 1px 2px;
        }
        
        #typora-commander-form input {
            width: 80%;
            margin-left: 0;
            margin-right: 2.5px;
            padding-left: 5px
            overflow: auto;
        }
        
        #typora-commander-form input:focus {
            outline: 0
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
        `
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = modal_css;
        document.getElementsByTagName("head")[0].appendChild(style);

        const div = `
       <div id="typora-commander-form">
            <input type="text" class="input" placeholder="Typora commander" autocorrect="off" spellcheck="false"
                autocapitalize="off" data-lg="Front" title="提供如下变量:\n$f 当前文件路径\n$d 当前文件所属目录\n$m 当前挂载目录">
            <select>
                <option value="">cmd/bash</option>
                <option value="${SHELL.POWER_SHELL}">powershell</option>
                <option value="${SHELL.GIT_BASH}">git bash</option>
                <option value="${SHELL.WSL}">wsl</option>
            </select>
        </div>
    
        <div class="typora-commander-output" id="typora-commander-output" style="display:none"><pre></pre></div>
       `
        const modal = document.createElement("div");
        modal.id = 'typora-commander';
        modal.style.display = "none";
        modal.innerHTML = div;
        const searchPanel = document.getElementById("md-searchpanel");
        searchPanel.parentNode.insertBefore(modal, searchPanel.nextSibling);
    })()

    const modal = {
        modal: document.getElementById('typora-commander'),
        input: document.querySelector("#typora-commander-form input"),
        select: document.querySelector("#typora-commander-form select"),
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
        const tempList = path.split(":");
        if (tempList.length !== 2) {
            return path
        }

        const disk = tempList[0].toLowerCase();
        const remain = tempList[1];
        switch (shell) {
            case SHELL.GIT_BASH:
                return `/${disk}${remain}`;
            case SHELL.WSL:
                return `/mnt/${disk}${remain}`;
            default:
                return path;
        }
    }

    const getFile = shell => convertPath(File.filePath.replace(/\\/g, "/"), shell);
    const getFolder = shell => convertPath(Package.path.dirname(File.filePath).replace(/\\/g, "/"), shell);
    const getMountFolder = shell => convertPath(File.getMountFolder().replace(/\\/g, "/"), shell);

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
                return `wsl.exe -d ${config.WSL_DISTRIBUTION} -e bash -c`
            default:
                return File.isMac ? `bash -c` : `cmd /C`;
        }
    }

    const exec = (cmd, shell, resolve, reject) => {
        const _shell = getShellCommand(shell);
        const _cmd = replaceArgs(cmd, shell);
        Package.child_process.exec(`chcp 65001 | ${_shell} "${_cmd}"`, {encoding: 'utf8'},
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

    const showOutput = stdout => {
        modal.output.style.display = "block";
        modal.pre.classList.remove("error");
        modal.pre.textContent = stdout;
    }

    const showErrorOutput = stderr => {
        showOutput(stderr);
        modal.pre.classList.add("error");
    }

    modal.input.addEventListener("keydown", ev => {
        switch (ev.key) {
            case "Enter":
                const cmd = modal.input.value;
                const index = modal.select.selectedIndex;
                const shell = modal.select.options[index].value;
                exec(cmd, shell, showOutput, showErrorOutput);
                break
            case "Escape":
                ev.stopPropagation();
                ev.preventDefault();
                modal.modal.style.display = "none";
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

    if (config.DEBUG) {
        JSBridge.invoke("window.toggleDevTools");
        global._exec = exec;
    }
    console.log("commander.js had been injected");
})()