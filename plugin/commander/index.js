const { createProcessManager, SHELL_REGISTRY } = require("./engine.js")

const createShellManager = (registry, formatter) => {
  const shells = Object.entries(registry)
  const executors = Object.fromEntries(shells.map(([id, s]) => [id, s.executor]))
  return {
    hasShell: (id) => Object.hasOwn(executors, id),
    getExecutor: (id) => executors[id],
    getDefaultValue: () => shells[0]?.[0],
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
      return [...history].reverse().map((item, index) => ({
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

const createEnvManager = (defs, normalizeEnvVars, formatter) => ({
  buildEnvVars: (norm) => Object.fromEntries(Object.entries(defs).map(([key, def]) => [key, def.get(norm)])),
  buildDropdownOptions: (shellExecutor) => Object.entries(defs).map(([key, def]) => {
    const env = normalizeEnvVars ? `$${key}` : shellExecutor.formatEnvVar(key)
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
    20,
    this.utils.getStorage(`${this.fixedName}.commands`),
    item => `[${item.shell}] ${item.cmd.length > 30 ? item.cmd.substring(0, 30) + "..." : item.cmd}`,
  )
  envManager = createEnvManager(
    {
      f: { desc: "Current File", get: norm => norm(this.utils.getFilePath()) },
      d: { desc: "Current Dir", get: norm => norm(this.utils.getCurrentDirPath()) },
      m: { desc: "Mount Dir", get: norm => norm(this.utils.getMountFolder()) },
      c: { desc: "File Content", get: () => this.utils.getCurrentFileContent() },
    },
    this.config.NORMALIZE_ENV_VARS,
    (env, desc) => `${env} - ${desc}`,
  )
  builtinManager = createBuiltinManager(
    this.config.BUILTIN,
    this.shellManager,
    item => `[${item.shell}] ${item.name}`,
  )
  ACT_VALUE_PREFIX = "call_builtin@"
  DISPLAY_TYPES = { ALWAYS: "always", ERROR: "error", SILENT: "silent", ECHO: "echo" }
  postScript = (() => {
    const hook = this.utils.safeEval(this.config.POST_SCRIPT)
    return (typeof hook === "function") ? hook : this.utils.noop
  })()
  staticActions = (() => {
    const defaultAction = { act_name: this.i18n.t("act.toggle_panel"), act_value: "toggle_panel", act_hotkey: this.config.HOTKEY }
    const customActions = this.builtinManager.getItems()
      .filter(a => a.name && a.cmd)
      .map(a => ({ act_name: a.name, act_value: this.ACT_VALUE_PREFIX + a.name, act_hotkey: a.hotkey }))
    return [defaultAction, ...customActions]
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
              <fast-dropdown class="plugin-commander-dropdown plugin-commander-env" no-label icon="fa fa-plus-circle" ty-hint="${this.i18n.t("tooltip.env")}"></fast-dropdown>
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

  _insertCmdAtCursor = (text, formatter = this._defaultSmartPadding) => {
    const el = this.entities.cmd
    const { selectionStart: start, selectionEnd: end, value } = el
    const insertText = formatter?.(text, { value, start, end })
    el.value = value.substring(0, start) + insertText + value.substring(end)
    el.selectionStart = el.selectionEnd = start + insertText.length
    el.dispatchEvent(new Event("input"))
    el.focus()
  }

  _defaultSmartPadding = (txt, ctx) => {
    let prefix = ""
    let suffix = ""
    if (ctx.start > 0 && /\w/.test(ctx.value[ctx.start - 1])) prefix = " "
    if (ctx.end < ctx.value.length && /\w/.test(ctx.value[ctx.end])) suffix = " "
    return prefix + txt + suffix
  }

  _setRunningState = (isRunning) => {
    const { btnCommit } = this.entities
    btnCommit.classList.toggle("fa-play", !isRunning)
    btnCommit.classList.toggle("fa-stop", isRunning)
    btnCommit.classList.toggle("running", isRunning)
  }

  process = () => {
    this.entities.btnCommit.addEventListener("click", () => this.processManager.isRunning ? this.processManager.terminate() : this.commitExecute())
    this.entities.badgeShell.addEventListener("change", ev => {
      this._updateEnvOptions(ev.detail.value)
      this.entities.cmd.focus()
    })
    this.entities.badgeBuiltin.addEventListener("change", ev => {
      const option = ev.detail.option
      if (!option?.cmd) return
      this.entities.badgeShell.setValue(option.shell)
      this.entities.badgeBuiltin.setValue("")
      this._setCmdValue(option.cmd, true)
    })
    this.entities.badgeHistory.addEventListener("change", ev => {
      const option = ev.detail.option
      if (!option?.cmd) return
      this.entities.badgeShell.setValue(option.shell)
      this.entities.badgeHistory.setValue("")
      this._setCmdValue(option.cmd, true)
    })
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

  _prepareExecutionUI = (shell, cmd, isEchoOrAlways) => {
    this._setCmdValue(cmd, false)
    this.entities.badgeShell.setValue(shell)
    this.entities.pre.textContent = ""
    this.entities.pre.classList.remove("error")
    if (isEchoOrAlways) this.showPanel()
    this._setRunningState(true)
  }

  _buildExecutionOptions = (isEchoOrAlways, isError) => {
    const pre = this.entities.pre
    return {
      cwd: this.utils.getCurrentDirPath(),
      timeout: this.config.TIMEOUT,
      normalizeEnvVars: this.config.NORMALIZE_ENV_VARS,
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
          this.postScript?.(payload)
        },
      },
    }
  }

  runCommand = (shell, cmd, displayType) => {
    const executor = this.shellManager.getExecutor(shell)
    if (!executor) throw new Error(`No such shell: ${shell}`)

    const { ECHO, ALWAYS, ERROR } = this.DISPLAY_TYPES
    const isError = displayType === ERROR
    const isEchoOrAlways = displayType === ECHO || displayType === ALWAYS

    this._recordHistory(shell, cmd)
    this._prepareExecutionUI(shell, cmd, isEchoOrAlways)

    const executionOptions = this._buildExecutionOptions(isEchoOrAlways, isError)
    this.processManager.run(executor, cmd, executionOptions)
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
      const target = this.builtinManager.findByName(name)
      if (target) this.quickExecute(target.shell, target.cmd)
    }
  }
}

module.exports = {
  plugin: CommanderPlugin,
}
