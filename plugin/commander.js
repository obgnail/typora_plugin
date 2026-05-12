/**
 * Implementing this plugin requires three types of compatibility:
 * 1. Abstracting operating system differences to support Windows and Linux.
 * 2. Abstracting shell differences to support cmd, WSL, and bash, including nested shell calls.
 * 3. Abstracting parameter differences, where cmd uses %VAR% and bash uses $VAR.
 */
class BaseShell {
  constructor(context) {
    this.context = context
  }

  normalizePath(path) {
    return path
  }

  replaceArgs(cmd) {
    const replacements = {
      f: this.normalizePath(this.context.getFile()),
      d: this.normalizePath(this.context.getFolder()),
      m: this.normalizePath(this.context.getMountFolder()),
    }
    return cmd.replace(/\$([fdm])\b/g, match => `"${replacements[match.slice(1)]}"`)
  }

  getCommand(cmd) {
    throw new Error("getCommand must be implemented by subclass")
  }
}

class PosixShell extends BaseShell {
  normalizePath(path) {
    if (!path || !this.context.isWin) return path
    return path.replace(/\\/g, "/").replace(/^(\w+):/, (_, drive) => `/${drive.toLowerCase()}`)
  }
}

class CmdShell extends BaseShell {
  getCommand(cmd) {
    const nestCommand = this.replaceArgs(cmd)
    return `chcp 65001 | cmd /C "${nestCommand}"`
  }
}

class BashShell extends PosixShell {
  getCommand(cmd) {
    const nestCommand = this.replaceArgs(cmd)
    return `bash -c "${nestCommand}"`
  }
}

class PowerShell extends BaseShell {
  getCommand(cmd) {
    const nestCommand = this.replaceArgs(cmd)
    const prefix = this.context.isWin ? "chcp 65001 | " : ""
    return `${prefix}powershell /C "${nestCommand}"`
  }
}

class GitBash extends PosixShell {
  getCommand(cmd) {
    const nestCommand = this.replaceArgs(cmd)
    const prefix = this.context.isWin ? "chcp 65001 | " : ""
    return `${prefix}bash.exe -c "${nestCommand}"`
  }
}

class Wsl extends PosixShell {
  normalizePath(path) {
    const posixPath = super.normalizePath(path)
    if (posixPath && this.context.isWin && !posixPath.startsWith("/mnt")) {
      return "/mnt" + posixPath
    }
    return posixPath
  }

  getCommand(cmd) {
    const nestCommand = this.replaceArgs(cmd)
    const prefix = this.context.isWin ? "chcp 65001 | " : ""
    return `${prefix}wsl.exe -e bash -c "${nestCommand}"`
  }
}

class CommandExecutor {
  static _runSpawn({ command, cwd, options, hooks }) {
    const { spawn } = require("child_process")
    const { onStdout, onStderr, onClose } = hooks

    const child = spawn(command, { encoding: "utf8", cwd, shell: true, ...options })
    child.stdout.on("data", data => onStdout?.(data.toString()))
    child.stderr.on("data", data => onStderr?.(data.toString()))
    child.on("close", code => {
      const error = code !== 0 ? new Error(`Process exited with code ${code}`) : null
      onClose?.({ code, error, stdout: null, stderr: null })
    })
  }

  static _runExec({ command, cwd, options, hooks }) {
    const { exec } = require("child_process")
    const { onStdout, onStderr, onClose } = hooks

    exec(command, { encoding: "utf8", cwd, ...options }, (error, stdout, stderr) => {
      const hasError = error || stderr.length > 0
      if (hasError) {
        onStderr?.(error ? error.message : stderr.toString())
      } else {
        onStdout?.(stdout)
      }
      onClose?.({ error, stdout, stderr, code: error ? (error.code || 1) : 0 })
    })
  }

  static execute({ useSpawn, command, cwd, options = {}, hooks = {} }) {
    const context = { command, cwd, options, hooks }
    if (useSpawn) {
      this._runSpawn(context)
    } else {
      this._runExec(context)
    }
  }
}

class CommanderPlugin extends BasePlugin {
  ACT_VALUE_PREFIX = "call_builtin@"
  DISPLAY_TYPE = { ALWAYS: "always", ERROR: "error", SILENT: "silent", ECHO: "echo" }
  SHELL = { CMD_BASH: "cmd/bash", POWER_SHELL: "powershell", GIT_BASH: "gitbash", WSL: "wsl" }
  BUILTINS = (() => {
    const shells = Object.values(this.SHELL)
    let ret = this.config.BUILTIN.filter(e => !e.disable && e.shell && shells.includes(e.shell))
    if (!File.isWin) {
      ret = ret.filter(e => e.shell !== this.SHELL.CMD_BASH)
    }
    return ret
  })()
  STRATEGIES = (() => {
    const ctx = {
      isWin: File.isWin,
      getFile: () => this.utils.getFilePath() || "",
      getFolder: () => this.utils.getCurrentDirPath() || "",
      getMountFolder: () => this.utils.getMountFolder() || "",
    }
    return {
      [this.SHELL.CMD_BASH]: ctx.isWin ? new CmdShell(ctx) : new BashShell(ctx),
      [this.SHELL.POWER_SHELL]: new PowerShell(ctx),
      [this.SHELL.GIT_BASH]: new GitBash(ctx),
      [this.SHELL.WSL]: new Wsl(ctx),
    }
  })()
  staticActions = (() => {
    const defaultAction = { act_name: this.i18n.t("act.toggle_panel"), act_value: "toggle_panel", act_hotkey: this.config.HOTKEY }
    const customActions = this.BUILTINS
      .filter(a => a.name && a.cmd)
      .map(a => ({ act_name: a.name, act_value: this.ACT_VALUE_PREFIX + a.name, act_hotkey: a.hotkey }))
    return [defaultAction, ...customActions]
  })()

  style = () => true

  html = () => {
    const { CMD_BASH, POWER_SHELL, GIT_BASH, WSL } = this.SHELL
    const genShell = (shell, text) => `<option value="${shell}">${text}</option>`
    const shells = [genShell(CMD_BASH, "CMD/Bash")]
    if (File.isWin) {
      shells.push(genShell(POWER_SHELL, "PowerShell"), genShell(GIT_BASH, "Git Bash"), genShell(WSL, "WSL"))
    }
    const builtins = this.BUILTINS.map(e => `<option data-shell="${e.shell}" value="${this.utils.escape(e.cmd)}">${e.name}</option>`)
    return `
      <fast-window id="plugin-commander" window-title="${this.pluginName}" window-buttons="close|fa-times" hidden>
        <form id="plugin-commander-form">
          <div class="plugin-commander-input-wrap">
            <div class="ion-ios7-play plugin-commander-commit plugin-common-hidden" ty-hint="${this.i18n.t("runCommand")}"></div>
            <input type="text" class="plugin-commander-input" ty-hint="${this.i18n.t("$placeholder.envInfo")}">
          </div>
          <select class="plugin-commander-shell">${shells.join("")}</select>
          <select class="plugin-commander-builtin">${builtins.join("")}</select>
        </form>
        <div class="plugin-commander-output"><pre></pre></div>
      </fast-window>`
  }

  hotkey = () => {
    const defaultHotkey = { hotkey: this.config.HOTKEY, callback: this.call }
    const customHotkeys = this.BUILTINS
      .filter(({ hotkey, cmd }) => hotkey && cmd)
      .map(({ hotkey, cmd, shell }) => ({ hotkey, callback: () => this.quickExecute(cmd, shell) }))
    return [defaultHotkey, ...customHotkeys]
  }

  init = () => {
    this.entities = {
      panel: document.querySelector("#plugin-commander"),
      form: document.querySelector("#plugin-commander-form"),
      input: document.querySelector(".plugin-commander-input"),
      selectShell: document.querySelector(".plugin-commander-shell"),
      selectBuiltin: document.querySelector(".plugin-commander-builtin"),
      commit: document.querySelector(".plugin-commander-commit"),
      pre: document.querySelector(".plugin-commander-output pre"),
    }
  }

  process = () => {
    this.entities.commit.addEventListener("click", () => this.commitExecute())
    this.entities.selectShell.addEventListener("change", () => this.entities.input.focus())
    this.entities.selectBuiltin.addEventListener("change", ev => {
      const option = ev.target.selectedOptions[0]
      if (!option) return
      this.entities.selectShell.value = option.dataset.shell
      this.entities.input.value = option.value
      this.entities.input.dispatchEvent(new Event("input"))
      this.entities.input.focus()
    })
    this.entities.input.addEventListener("input", ev => {
      const hasCMD = ev.target.value.trim()
      this.utils.toggleInvisible(this.entities.commit, !hasCMD)
      if (!hasCMD) this.entities.selectBuiltin.value = ""
    })
    this.entities.form.addEventListener("submit", ev => {
      ev.preventDefault()
      this.commitExecute()
    })
    this.entities.form.addEventListener("keydown", ev => {
      const wantHide = ev.key === "Escape" || (ev.key === "Backspace" && this.config.BACKSPACE_TO_HIDE && !this.entities.input.value)
      if (wantHide) this.entities.panel.hide()
    })
    this.entities.panel.addEventListener("btn-click", ev => {
      if (ev.detail.action === "close") this.entities.panel.hide()
    })
  }

  _refreshPanel = (cmd, shell, show = false) => {
    this.entities.input.value = cmd
    this.entities.input.dispatchEvent(new Event("input"))
    this.entities.selectShell.value = shell
    this.entities.pre.textContent = ""
    this.entities.pre.classList.remove("error")
    if (show) this.entities.panel.show()
  }

  runCommand = (type, cmd, shell) => {
    const strategy = this.STRATEGIES[shell]
    if (!strategy) {
      throw new Error(`No such Shell Strategy: ${shell}`)
    }

    const { ECHO, ALWAYS, ERROR } = this.DISPLAY_TYPE
    const isEcho = type === ECHO

    this._refreshPanel(cmd, shell, isEcho)

    const pre = this.entities.pre
    const ensureVisible = this.utils.once(() => !isEcho && this.entities.panel.show())
    const _onStdout = (data) => {
      ensureVisible()
      pre.append(data)
    }
    const _onStderr = (data) => {
      ensureVisible()
      pre.append(data)
      pre.classList.add("error")
    }

    CommandExecutor.execute({
      useSpawn: isEcho,
      cwd: strategy.context.getFolder(),
      command: strategy.getCommand(cmd),
      hooks: {
        onStdout: (isEcho || type === ALWAYS) ? _onStdout : null,
        onStderr: (isEcho || type === ALWAYS || type === ERROR) ? _onStderr : null,
        onClose: null,
      },
    })
  }

  quickExecute = (cmd, shell) => this.runCommand(this.config.QUICK_RUN_DISPLAY, cmd, shell)

  commitExecute = () => {
    const cmd = this.entities.input.value
    if (!cmd) {
      this.entities.panel.show()
      this.entities.pre.textContent = "Empty Command"
      this.entities.pre.classList.add("error")
    } else {
      const option = this.entities.selectShell.selectedOptions[0]
      if (option) this.runCommand(this.config.COMMIT_RUN_DISPLAY, cmd, option.value)
    }
  }

  togglePanel = () => {
    const hidden = this.entities.panel.hidden
    this.entities.panel.toggle()
    if (hidden) this.entities.input.select()
  }

  call = (action = "toggle_panel") => {
    if (action === "toggle_panel") {
      this.togglePanel()
    } else if (action.startsWith(this.ACT_VALUE_PREFIX)) {
      const name = action.slice(this.ACT_VALUE_PREFIX.length)
      const target = this.BUILTINS.find(c => c.name === name)
      if (target) this.quickExecute(target.cmd, target.shell)
    }
  }
}

module.exports = {
  plugin: CommanderPlugin,
}
