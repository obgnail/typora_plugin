const { createProcessManager, SHELL_REGISTRY } = require("./engine.js")

class CommanderPlugin extends BasePlugin {
  processManager = createProcessManager()
  ACT_VALUE_PREFIX = "call_builtin@"
  DISPLAY_TYPES = { ALWAYS: "always", ERROR: "error", SILENT: "silent", ECHO: "echo" }
  EXECUTORS = Object.fromEntries(Object.entries(SHELL_REGISTRY).map(([id, s]) => [id, s.executor]))
  BUILTINS = this.config.BUILTIN.filter(e => !e.disable && Object.hasOwn(SHELL_REGISTRY, e.shell))
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
      .map(({ shell, cmd, hotkey }) => ({ hotkey, callback: () => this.quickExecute(shell, cmd) }))
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

    const shellOptions = Object.entries(SHELL_REGISTRY).map(([id, s]) => ({ value: id, label: s.label }))
    this.entities.badgeShell.setOptions(shellOptions).setValue(shellOptions[0].value)
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
      if (ev.key === "Escape") this.hidePanel()
    })
    this.entities.cmd.addEventListener("keydown", ev => {
      if (ev.key === "Enter") {
        if (!ev.shiftKey) {
          ev.preventDefault()
          this.commitExecute()
        }
      } else if (ev.key === "Backspace" && this.config.BACKSPACE_TO_HIDE && !this.entities.cmd.value) {
        this.hidePanel()
      }
    })
    this.entities.panel.addEventListener("btn-click", ev => {
      if (ev.detail.action === "close") this.hidePanel()
    })
  }

  _refreshPanel = (shellName, cmd, show = false) => {
    this.entities.cmd.value = cmd
    this.entities.cmd.dispatchEvent(new Event("input"))
    this.entities.badgeShell.setValue(shellName)
    this.entities.pre.textContent = ""
    this.entities.pre.classList.remove("error")
    if (show) this.showPanel()
  }

  _setRunningState = (isRunning) => {
    const { commit } = this.entities
    commit.classList.toggle("ion-ios7-play", !isRunning)
    commit.classList.toggle("ion-stop", isRunning)
    commit.classList.toggle("running", isRunning)
  }

  runCommand = (shellName, cmd, displayType) => {
    const shell = this.EXECUTORS[shellName]
    if (!shell) {
      throw new Error(`No such shell: ${shellName}`)
    }

    const { ECHO, ALWAYS, ERROR } = this.DISPLAY_TYPES
    const isError = displayType === ERROR
    const isEchoOrAlways = displayType === ECHO || displayType === ALWAYS

    this._refreshPanel(shellName, cmd, isEchoOrAlways)
    this._setRunningState(true)

    const pre = this.entities.pre
    const _onStdout = (data) => pre.append(data)
    const _onStderr = (data) => {
      pre.append(data)
      pre.classList.add("error")
      if (isError) this.showPanel()
    }

    this.processManager.run(shell, cmd, {
      cwd: this.utils.getCurrentDirPath(),
      timeout: this.config.TIMEOUT,
      normalizeEnvVars: this.config.NORMALIZE_ENV_VARS,
      hooks: {
        onStdout: isEchoOrAlways ? _onStdout : null,
        onStderr: (isEchoOrAlways || isError) ? _onStderr : null,
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

  quickExecute = (shell, cmd) => this.runCommand(shell, cmd, this.config.QUICK_RUN_DISPLAY)
  commitExecute = (shell = this.entities.badgeShell.getValue(), cmd = this.entities.cmd.value) => this.runCommand(shell, cmd, this.config.COMMIT_RUN_DISPLAY)

  hidePanel = () => this.entities.panel.hide()
  showPanel = () => this.entities.panel.show()
  togglePanel = () => this.entities.panel.toggle()

  call = (action = "toggle_panel") => {
    if (action === "toggle_panel") {
      this.togglePanel()
    } else if (action.startsWith(this.ACT_VALUE_PREFIX)) {
      const name = action.slice(this.ACT_VALUE_PREFIX.length)
      const target = this.BUILTINS.find(c => c.name === name)
      if (target) this.quickExecute(target.shell, target.cmd)
    }
  }
}

module.exports = {
  plugin: CommanderPlugin,
}
