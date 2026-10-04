const parseCommandLineArgs = args => {
  const result = []
  let currentArg = ""
  let inQuote = false
  let escapeNextChar = false

  for (let i = 0; i < args.length; i++) {
    const char = args[i]

    if (escapeNextChar) {
      currentArg += char
      escapeNextChar = false
    } else if (char === "\\") {
      escapeNextChar = true
    } else if (char === " ") {
      if (inQuote) {
        currentArg += char
      } else if (currentArg) {
        result.push(currentArg)
        currentArg = ""
      }
    } else if (char === `"`) {
      if (inQuote) {
        if (args[i - 1] !== "\\") {
          inQuote = false
        }
      } else {
        inQuote = true
      }
    } else {
      currentArg += char
    }
  }

  if (currentArg) {
    result.push(currentArg)
  }

  // Split options with values
  const parsedResult = []
  for (const arg of result) {
    const equalIndex = arg.indexOf("=")
    if (equalIndex !== -1) {
      parsedResult.push(arg.substring(0, equalIndex))
      parsedResult.push(arg.substring(equalIndex + 1))
    } else {
      parsedResult.push(arg)
    }
  }

  return parsedResult
}

const createSoloProcess = () => {
  let current = null

  const kill = () => current?.kill()
  const run = (command, args, options, hooks) => {
    kill()
    const child = require("child_process").spawn(command, parseCommandLineArgs(args), options)
    current = child
    const alive = () => current === child
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", data => alive() && hooks.onData(data))
    child.stderr.on("data", data => alive() && hooks.onErr(data))
    child.on("error", err => alive() && hooks.onErr(err.toString() + "\n"))
    child.on("close", (code, signal) => {
      if (alive()) current = null
      hooks.onClose(code, signal)
    })
  }

  return { run, kill }
}

class RipgrepPlugin extends BasePlugin {
  _rg = createSoloProcess()

  style = () => true

  html = () =>
    `<div id="plugin-ripgrep" class="plugin-common-panel plugin-common-hidden">
      <form id="plugin-ripgrep-form">
        <div class="plugin-ripgrep-prefix"><b>rg</b></div>
        <input type="text" placeholder='[options] PATTERN [path]'/>
      </form>
      <div class="plugin-ripgrep-output plugin-common-hidden"><pre tabindex="0"></pre></div>
    </div>`

  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  init = () => {
    this.entities = {
      panel: document.getElementById("plugin-ripgrep"),
      form: document.getElementById("plugin-ripgrep-form"),
      input: document.querySelector("#plugin-ripgrep-form input"),
      output: document.querySelector(".plugin-ripgrep-output"),
      pre: document.querySelector(".plugin-ripgrep-output pre"),
    }
  }

  process = () => {
    this.entities.form.addEventListener("submit", ev => {
      ev.preventDefault()
      this.ripgrep()
    })
    this.entities.form.addEventListener("keydown", ev => {
      const toHide = ev.key === "Escape" || (ev.key === "Backspace" && this.config.BACKSPACE_TO_HIDE && !this.entities.input.value)
      if (toHide) this.call()
    })
  }

  call = () => {
    const { panel, input } = this.entities
    this.utils.toggleInvisible(panel)
    if (this.utils.isShown(panel)) {
      input.select()
    } else {
      this._rg.kill()
    }
  }

  /** @example: ripgrep("--max-filesize 2M -g *.md XXX", (code, signal) => console.log("finish code:", code)) */
  ripgrep = (rawInput = this.entities.input.value, onClose = this.utils.noop) => {
    const addErrClass = this.utils.once(() => this.entities.pre.classList.add("error"))
    const onData = data => data && this.entities.pre.append(data)
    const onErr = data => {
      onData(data)
      addErrClass()
    }
    this._resetOutput()
    this._ripgrep(rawInput, { onData, onErr, onClose })
  }

  _ripgrep = (rawInput, { onData, onErr, onClose }) => {
    const rgPath = reqnode("vscode-ripgrep").rgPath.replace("node_modules.asar", "node_modules")
    const options = { cwd: File.getMountFolder(), stdio: ["ignore", "pipe", "pipe"], env: { rg: rgPath } }
    this._rg.run(rgPath, rawInput, options, { onData, onErr, onClose })
  }

  _resetOutput = () => {
    const { pre, output } = this.entities
    pre.textContent = ""
    pre.classList.remove("error")
    this.utils.show(output)
  }
}

module.exports = {
  plugin: RipgrepPlugin,
}
