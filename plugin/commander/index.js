const { createProcessManager, SHELL_REGISTRY } = require("./engine.js")

const createShellManager = (registry, formatter) => {
  const shells = Object.entries(registry)
  const executors = Object.fromEntries(shells.map(([id, s]) => [id, s.executor]))
  const hasShell = (id) => Object.hasOwn(executors, id)
  const getDefaultValue = () => shells[0]?.[0]
  return {
    hasShell,
    getExecutor: (id) => executors[id],
    getDefaultValue,
    resolveShell: (id) => hasShell(id) ? id : getDefaultValue(),
    buildDropdownOptions: () => shells.map(([id, s]) => ({ value: id, label: formatter(s) })),
  }
}

const createHistoryManager = (maxLimit, storage, formatter) => {
  const history = storage.get() || []
  return {
    add: (shell, cmd) => {
      if (!cmd) return
      const last = history.at(-1)
      if (!last || last.shell !== shell || last.cmd !== cmd) {
        history.push({ shell, cmd })
        if (history.length > maxLimit) history.shift()
        storage.set(history)
      }
    },
    getAll: () => {
      const prefix = `hist-${Date.now()}`
      return history.toReversed().map((item, index) => ({
        value: `${prefix}-${index}`,
        label: formatter(item),
        shell: item.shell,
        cmd: item.cmd,
      }))
    },
    deleteAll: () => {
      history.length = 0
      storage.remove()
    },
  }
}

const createEnvManager = (defs, formatter) => ({
  buildEnvVars: (norm) => Object.fromEntries(Object.entries(defs).map(([key, def]) => [key, def.get(norm)])),
  buildDropdownOptions: (shellExecutor) => Object.entries(defs).map(([key, def]) => {
    const env = shellExecutor.formatEnvVar(key)
    return { value: env, label: formatter(env, def.desc) }
  }),
})

const createBuiltinManager = (rawBuiltins, shellManager, formatter) => {
  const validItems = (rawBuiltins || []).filter(e => !e.disable && shellManager.hasShell(e.shell))
  return {
    getItems: () => validItems,
    findByName: (name) => validItems.find(c => c.name === name),
    buildDropdownOptions: () => validItems.map((item, index) => ({
      value: `builtin-${index}`,
      label: formatter(item),
      shell: item.shell,
      cmd: item.cmd,
    })),
  }
}

class CommanderPlugin extends BasePlugin {
  processManager = createProcessManager()
  shellManager = createShellManager(
    SHELL_REGISTRY,
    item => item.label,
  )
  historyManager = createHistoryManager(
    this.config.MAX_HISTORY_ENTRIES || 20,
    this.utils.getStorage(`${this.fixedName}.commands`),
    item => `[${item.shell}] ${item.cmd.length > 30 ? item.cmd.substring(0, 30) + "..." : item.cmd}`,
  )
  envManager = createEnvManager(
    {
      f: { desc: "Current File", get: norm => norm(this.utils.getFilePath()) },
      d: { desc: "Current Dir", get: norm => norm(this.utils.getCurrentDirPath()) },
      m: { desc: "Mount Dir", get: norm => norm(this.utils.getMountFolder()) },
      // c: { desc: "File Content", get: () => this.utils.getCurrentFileContent() },
    },
    (env, desc) => `${env} - ${desc}`,
  )
  builtinManager = createBuiltinManager(
    this.config.BUILTIN,
    this.shellManager,
    item => `[${item.shell}] ${item.name}`,
  )
  ACT_VALUE_PREFIX = "invoke_builtin@"
  DISPLAY_TYPES = { ALWAYS: "always", ERROR: "error", SILENT: "silent", ECHO: "echo" }
  staticActions = [
    { act_name: this.i18n.t("act.toggle_panel"), act_value: "toggle_panel", act_hotkey: this.config.HOTKEY },
    ...this.builtinManager.getItems()
      .filter(c => c.name && c.cmd)
      .map(c => ({ act_name: c.name, act_value: this.ACT_VALUE_PREFIX + c.name, act_hotkey: c.hotkey })),
  ]
  postScript = (() => {
    const hook = this.utils.safeEval(this.config.POST_SCRIPT)
    return (typeof hook === "function") ? hook : this.utils.noop
  })()

  style = () => true

  html = () => `
    <fast-window id="plugin-commander" window-title="${this.pluginName}" window-buttons="close|fa-times" hidden>
      <div class="plugin-commander-wrap">
        <div id="plugin-commander-form">
          <div class="plugin-commander-toolbar">
            <div class="plugin-commander-toolbar-left">
              <fast-dropdown class="plugin-commander-dropdown plugin-commander-builtin" no-label icon="fa fa-bookmark" ty-hint="${this.i18n.t("tooltip.builtin")}"></fast-dropdown>
              <fast-dropdown class="plugin-commander-dropdown plugin-commander-history plugin-common-hidden" no-label icon="fa fa-history" ty-hint="${this.i18n.t("tooltip.history")}"></fast-dropdown>
              <fast-dropdown class="plugin-commander-dropdown plugin-commander-env" no-label icon="fa fa-usd" ty-hint="${this.i18n.t("tooltip.env")}"></fast-dropdown>
            </div>
            <div class="plugin-commander-toolbar-right">
              <fast-dropdown class="plugin-commander-dropdown plugin-commander-shell" ty-hint="${this.i18n.t("tooltip.shell")}"></fast-dropdown>
              <div class="plugin-commander-commit fa fa-play" ty-hint="${this.i18n.t("tooltip.execute")}"></div>
            </div>
          </div>
          <textarea class="plugin-commander-textarea" rows="8" placeholder="${this.i18n.t("placeholder.textarea")}"></textarea>
        </div>
        <div class="plugin-commander-output">
          <pre tabindex="0"></pre>
          <div class="plugin-commander-copy fa fa-copy" ty-hint="${this.i18n.t("tooltip.copy")}"></div>
        </div>
      </div>
    </fast-window>`

  hotkey = () => {
    const defaultHotkey = { hotkey: this.config.HOTKEY, callback: this.call }
    const customHotkeys = this.builtinManager.getItems()
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
      badgeHistory: document.querySelector(".plugin-commander-history"),
      badgeEnv: document.querySelector(".plugin-commander-env"),
      btnCommit: document.querySelector(".plugin-commander-commit"),
      btnCopy: document.querySelector(".plugin-commander-copy"),
      pre: document.querySelector(".plugin-commander-output pre"),
    }

    const defaultShell = this.shellManager.getDefaultValue()
    this.entities.badgeShell.setOptions(this.shellManager.buildDropdownOptions()).setValue(defaultShell)
    this.entities.badgeBuiltin.setOptions(this.builtinManager.buildDropdownOptions())
    this._updateEnvOptions(defaultShell)
    this._syncHistoryUI()
  }

  _updateEnvOptions = (shell) => {
    const executor = this.shellManager.getExecutor(shell)
    this.entities.badgeEnv.setOptions(this.envManager.buildDropdownOptions(executor))
  }

  _setCmdValue = (value, focus = false) => {
    const el = this.entities.cmd
    el.value = value
    el.dispatchEvent(new Event("input"))
    if (focus) el.focus()
  }

  _insertCmdAtCursor = (text) => {
    const el = this.entities.cmd
    const { selectionStart: start, selectionEnd: end, value } = el
    const insertText = this._smartPadding(text, { value, start, end })
    el.value = value.substring(0, start) + insertText + value.substring(end)
    el.selectionStart = el.selectionEnd = start + insertText.length
    el.dispatchEvent(new Event("input"))
    el.focus()
  }

  _smartPadding = (txt, ctx) => {
    let prefix = ""
    let suffix = ""
    if (ctx.start > 0 && /\w/.test(ctx.value[ctx.start - 1])) prefix = " "
    if (ctx.end < ctx.value.length && /\w/.test(ctx.value[ctx.end])) suffix = " "
    return prefix + txt + suffix
  }

  _setRunningState = (isRunning) => {
    const btn = this.entities.btnCommit
    btn.classList.toggle("fa-play", !isRunning)
    btn.classList.toggle("fa-stop", isRunning)
    btn.classList.toggle("running", isRunning)
  }

  process = () => {
    this.entities.btnCommit.addEventListener("click", () => this.processManager.isRunning ? this.processManager.terminate() : this.commitExecute())
    this.entities.badgeShell.addEventListener("change", ev => {
      this._updateEnvOptions(ev.detail.value)
      this.entities.cmd.focus()
    })
    const onPickCommand = badge => ev => {
      const option = ev.detail.option
      if (!option?.cmd) return
      const shell = this.shellManager.resolveShell(option.shell)
      this.entities.badgeShell.setValue(shell)
      badge.setValue("")
      this._updateEnvOptions(shell)
      this._setCmdValue(option.cmd, true)
    }
    this.entities.badgeBuiltin.addEventListener("change", onPickCommand(this.entities.badgeBuiltin))
    this.entities.badgeHistory.addEventListener("change", onPickCommand(this.entities.badgeHistory))
    this.entities.badgeEnv.addEventListener("change", ev => {
      const option = ev.detail.option
      if (!option?.value) return
      this.entities.badgeEnv.setValue("")
      this._insertCmdAtCursor(option.value)
    })
    this.entities.panel.addEventListener("keydown", ev => {
      ev.stopPropagation()
      if (ev.key === "Escape") this.hidePanel()
    })
    this.entities.cmd.addEventListener("keydown", ev => {
      if (ev.key === "Enter" && this.utils.metaKeyPressed(ev)) {
        ev.preventDefault()
        this.commitExecute()
      } else if (ev.key === "Backspace" && this.config.BACKSPACE_TO_HIDE && !this.entities.cmd.value) {
        this.hidePanel()
      }
    })
    this.entities.panel.addEventListener("btn-click", ev => {
      if (ev.detail.action === "close") this.hidePanel()
    })
    this.entities.btnCopy.addEventListener("click", async () => {
      const text = this.entities.pre.textContent
      if (!text) return
      await navigator.clipboard.writeText(text)
      this.entities.btnCopy.classList.replace("fa-copy", "fa-check")
      setTimeout(() => this.entities.btnCopy.classList.replace("fa-check", "fa-copy"), 1500)
    })
  }

  _syncHistoryUI = () => {
    const historyOptions = this.historyManager.getAll()
    this.entities.badgeHistory.setOptions(historyOptions)
    this.utils.toggleInvisible(this.entities.badgeHistory, historyOptions.length === 0)
  }
  _recordHistory = (shell, cmd) => {
    this.historyManager.add(shell, cmd)
    this._syncHistoryUI()
  }

  _prepareExecutionUI = (shell, cmd, displayType) => {
    const { ECHO, ALWAYS } = this.DISPLAY_TYPES
    this._setCmdValue(cmd, false)
    this.entities.badgeShell.setValue(shell)
    this.entities.pre.textContent = ""
    this.entities.pre.classList.remove("error")
    if (displayType === ECHO || displayType === ALWAYS) this.showPanel()
    this._setRunningState(true)
  }

  _buildExecutionOptions = (displayType) => {
    const { ECHO, ALWAYS, ERROR } = this.DISPLAY_TYPES
    const isEchoOrAlways = displayType === ECHO || displayType === ALWAYS
    const isError = displayType === ERROR
    const pre = this.entities.pre
    return {
      cwd: this.utils.getCurrentDirPath(),
      timeout: this.config.TIMEOUT,
      envVars: (norm) => this.envManager.buildEnvVars(norm),
      hooks: {
        onStdout: isEchoOrAlways
          ? (data) => pre.append(data)
          : null,
        onStderr: (isEchoOrAlways || isError)
          ? (data) => {
            pre.append(data)
            pre.classList.add("error")
            if (isError) this.showPanel()
          }
          : null,
        onExit: (payload) => {
          this._setRunningState(false)
          try {
            this.postScript?.(payload)
          } catch (e) {
            console.error("[commander] POST_SCRIPT failed:", e)
          }
        },
      },
    }
  }

  runCommand = (shell, cmd, displayType) => {
    const executor = this.shellManager.getExecutor(shell)
    if (!executor) throw new Error(`No such shell: ${shell}`)
    this._recordHistory(shell, cmd)
    this._prepareExecutionUI(shell, cmd, displayType)
    this.processManager.run(executor, cmd, this._buildExecutionOptions(displayType))
  }

  quickExecute = (shell, cmd) => this.runCommand(shell, cmd, this.config.QUICK_RUN_DISPLAY)
  commitExecute = (shell = this.entities.badgeShell.getValue(), cmd = this.entities.cmd.value) => cmd.trim() && this.runCommand(shell, cmd, this.config.COMMIT_RUN_DISPLAY)

  hidePanel = () => this.entities.panel.hide()
  showPanel = () => this.entities.panel.show()
  togglePanel = () => this.entities.panel.toggle()

  call = (action = "toggle_panel") => {
    if (action === "toggle_panel") {
      this.togglePanel()
      return
    }
    if (action.startsWith(this.ACT_VALUE_PREFIX)) {
      const name = action.slice(this.ACT_VALUE_PREFIX.length)
      const item = this.builtinManager.findByName(name)
      if (item) this.quickExecute(item.shell, item.cmd)
    }
  }
}

module.exports = {
  plugin: CommanderPlugin,
}
