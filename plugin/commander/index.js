const { createProcessManager, CmdShell, PowerShell, BashShell, GitBash, Wsl } = require("./engine.js")

class CommanderPlugin extends BasePlugin {
  processManager = createProcessManager()
  ACT_VALUE_PREFIX = "call_builtin@"
  DISPLAY_TYPES = { ALWAYS: "always", ERROR: "error", SILENT: "silent", ECHO: "echo" }
  SHELLS = { CMD_BASH: "cmd/bash", POWER_SHELL: "powershell", GIT_BASH: "gitbash", WSL: "wsl" }
  EXECUTORS = {
    [this.SHELLS.CMD_BASH]: File.isWin ? CmdShell : BashShell,
    [this.SHELLS.POWER_SHELL]: PowerShell,
    [this.SHELLS.GIT_BASH]: GitBash,
    [this.SHELLS.WSL]: Wsl,
  }
  BUILTINS = (() => {
    const shells = Object.values(this.SHELLS)
    let ret = this.config.BUILTIN.filter(e => !e.disable && e.shell && shells.includes(e.shell))
    if (!File.isWin) {
      ret = ret.filter(e => e.shell !== this.SHELLS.CMD_BASH)
    }
    return ret
  })()
  postScript = (() => {
    const hook = this.utils.safeEval(this.config.POST_SCRIPT)
    return (typeof hook === "function") ? hook : this.utils.noop
  })()
  staticActions = (() => {
    const defaultAction = { act_name: this.i18n.t("act.toggle_panel"), act_value: "toggle_panel", act_hotkey: this.config.HOTKEY }
    const customActions = this.BUILTINS
      .filter(a => a.name && a.cmd)
      .map(a => ({ act_name: a.name, act_value: this.ACT_VALUE_PREFIX + a.name, act_hotkey: a.hotkey }))
    return [defaultAction, ...customActions]
  })()

  style = () => true

  html = () => `
    <fast-window id="plugin-commander" window-title="${this.pluginName}" window-buttons="close|fa-times" hidden>
      <div id="plugin-commander-form">
        <div class="plugin-commander-wrap">
          <textarea class="plugin-commander-textarea" rows="9" placeholder="${this.i18n.t("$placeholder.envInfo")}"></textarea>
          <div class="plugin-commander-badges">
            <fast-dropdown class="plugin-commander-builtin" no-label icon="ion-code"></fast-dropdown>
            <div class="plugin-commander-badges-right">
              <div class="plugin-commander-commit ion-ios7-play"></div>
              <fast-dropdown class="plugin-commander-shell"></fast-dropdown>
            </div>
          </div>
        </div>
      </div>
      <div class="plugin-commander-output"><pre tabindex="0"></pre></div>
    </fast-window>`

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
      cmd: document.querySelector(".plugin-commander-textarea"),
      badgeShell: document.querySelector(".plugin-commander-shell"),
      badgeBuiltin: document.querySelector(".plugin-commander-builtin"),
      commit: document.querySelector(".plugin-commander-commit"),
      pre: document.querySelector(".plugin-commander-output pre"),
    }

    const { CMD_BASH, POWER_SHELL, GIT_BASH, WSL } = this.SHELLS
    const shells = [
      { value: CMD_BASH, label: "CMD/Bash" },
      ...(File.isWin && [{ value: POWER_SHELL, label: "PowerShell" }, { value: GIT_BASH, label: "GitBash" }, { value: WSL, label: "WSL" }]),
    ]
    this.entities.badgeShell.setOptions(shells).setValue(CMD_BASH)
    this.entities.badgeBuiltin.setOptions(this.BUILTINS.map(e => ({ value: e.cmd, label: e.name, shell: e.shell })))
  }

  process = () => {
    this.entities.commit.addEventListener("click", () => this.processManager.isRunning ? this.processManager.terminate() : this.commitExecute())
    this.entities.badgeShell.addEventListener("change", () => this.entities.cmd.focus())
    this.entities.badgeBuiltin.addEventListener("change", ev => {
      const option = ev.detail.option
      if (!option || !option.value) return
      this.entities.badgeShell.setValue(option.shell)
      this.entities.badgeBuiltin.setValue("")
      this.entities.cmd.value = option.value
      this.entities.cmd.dispatchEvent(new Event("input"))
      this.entities.cmd.focus()
    })
    this.entities.panel.addEventListener("keydown", ev => {
      ev.stopPropagation()
      if (ev.key === "Escape") this.entities.panel.hide()
    })
    this.entities.cmd.addEventListener("keydown", ev => {
      if (ev.key === "Enter") {
        if (!ev.shiftKey) {
          ev.preventDefault()
          this.commitExecute()
        }
      } else if (ev.key === "Backspace" && this.config.BACKSPACE_TO_HIDE && !this.entities.cmd.value) {
        this.entities.panel.hide()
      }
    })
    this.entities.panel.addEventListener("btn-click", ev => {
      if (ev.detail.action === "close") this.entities.panel.hide()
    })
  }

  _refreshPanel = (cmd, shell, show = false) => {
    this.entities.cmd.value = cmd
    this.entities.cmd.dispatchEvent(new Event("input"))
    this.entities.badgeShell.setValue(shell)
    this.entities.pre.textContent = ""
    this.entities.pre.classList.remove("error")
    if (show) this.entities.panel.show()
  }

  _setRunningState = (isRunning) => {
    const { commit } = this.entities
    commit.classList.toggle("ion-ios7-play", !isRunning)
    commit.classList.toggle("ion-stop", isRunning)
    commit.classList.toggle("running", isRunning)
  }

  runCommand = (type, cmd, shellName) => {
    const shell = this.EXECUTORS[shellName]
    if (!shell) {
      throw new Error(`No such Shell Strategy: ${shellName}`)
    }

    const { ECHO, ALWAYS, ERROR } = this.DISPLAY_TYPES
    const isEcho = type === ECHO

    this._refreshPanel(cmd, shellName, isEcho)
    this._setRunningState(true)
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

    this.processManager.run(shell, cmd, {
      cwd: this.utils.getCurrentDirPath(),
      timeout: this.config.TIMEOUT,
      normalizeEnvVars: this.config.NORMALIZE_ENV_VARS,
      hooks: {
        onStdout: (isEcho || type === ALWAYS) ? _onStdout : null,
        onStderr: (isEcho || type === ALWAYS || type === ERROR) ? _onStderr : null,
        onExit: (payload) => {
          this._setRunningState(false)
          this.postScript?.(payload)
        },
      },
      envVars: (normalizePath) => ({
        f: normalizePath(this.utils.getFilePath()),
        d: normalizePath(this.utils.getCurrentDirPath()),
        m: normalizePath(this.utils.getMountFolder()),
      }),
    })
  }

  quickExecute = (cmd, shell) => this.runCommand(this.config.QUICK_RUN_DISPLAY, cmd, shell)

  commitExecute = () => {
    const cmd = this.entities.cmd.value
    if (!cmd) {
      this.entities.panel.show()
      this.entities.pre.textContent = ""
    } else {
      this.runCommand(this.config.COMMIT_RUN_DISPLAY, cmd, this.entities.badgeShell.getValue())
    }
  }

  togglePanel = () => this.entities.panel.toggle()

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
