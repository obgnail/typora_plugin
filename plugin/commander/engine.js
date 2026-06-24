const fs = require("fs")
const path = require("path")
const { spawn } = require("child_process")

const IS_WIN = process.platform === "win32"

function _normalizeVars(cmd, vars, formatEnvVarFn) {
  cmd = cmd.trim()
  if (vars.length === 0) return cmd
  const pattern = vars
    .sort((a, b) => b.length - a.length)
    .map(str => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")
  return cmd.replace(new RegExp(`\\$(${pattern})\\b`, "g"), (_, key) => formatEnvVarFn(key))
}

function _prepare(shell, cmd, cwd, envVars, normalizeEnvVars) {
  const rawCwd = (typeof cwd === "function" ? cwd() : cwd) || process.cwd()
  const customEnv = typeof envVars === "function" ? envVars(shell.normalizePath) : (envVars || {})
  return {
    rawCwd,
    customEnv,
    cwd: shell.normalizePath(rawCwd),
    env: { ...process.env, ...customEnv },
    script: normalizeEnvVars
      ? _normalizeVars(cmd, Object.keys(customEnv), shell.formatEnvVar)
      : cmd.trim(),
  }
}

function _attachHooks(child, hooks, command, stderrFilterFn) {
  child.stdout?.on("data", data => hooks.onStdout?.(data.toString()))
  child.stderr?.on("data", data => {
    let str = data.toString()
    if (stderrFilterFn) {
      str = stderrFilterFn(str)
      if (!str) return
    }
    hooks.onStderr?.(str)
  })
  child.on("error", err => hooks.onStderr?.(err.toString()))
  child.on("close", (code, signal) => {
    let error = null
    if (code !== 0) {
      error = code === null
        ? new Error(`Process terminated by signal ${signal} (Timeout)`)
        : new Error(`Process exited with code ${code}`)
    }
    hooks.onExit?.({ command, code, error })
  })
}

function executeShell(shell, cmd, opts = {}) {
  const { cwd, envVars, normalizeEnvVars = true, timeout = 0, hooks = {} } = opts
  const config = _prepare(shell, cmd, cwd, envVars, normalizeEnvVars)
  const { command, args, options } = shell.getSpawnConfig(config)
  const child = spawn(command, args, { ...options, timeout })
  _attachHooks(child, hooks, cmd, shell.getStderrFilter?.())
  const payload = shell.getStdinPayload ? shell.getStdinPayload(config) : `${config.script}\n`
  child.stdin.write(payload)
  child.stdin.end()
  return child
}

const _BaseShell = {
  normalizePath: (p) => p || "",
  formatEnvVar: (envName) => `$${envName}`,
}

const _PosixShell = {
  ..._BaseShell,
  normalizePath: (p) => (p && IS_WIN)
    ? p.replace(/\\/g, "/").replace(/^(\w+):/, (_, drive) => `/${drive.toLowerCase()}`)
    : (p || ""),
}

const CmdShell = {
  ..._BaseShell,
  formatEnvVar: (envName) => `%${envName}%`,
  getSpawnConfig: ({ env, cwd }) => ({
    command: "cmd",
    args: ["/Q", "/K", "@echo off & chcp 65001 >nul"],
    options: { cwd, env, shell: false },
  }),
  getStdinPayload: ({ script }) => `${script}\r\nexit %errorlevel%\r\n`,
}

const PowerShell = {
  ..._BaseShell,
  formatEnvVar: (envName) => `$env:${envName}`,
  getSpawnConfig: ({ env, cwd }) => ({
    command: "powershell",
    args: ["-NoProfile", "-NonInteractive", "-Command", "-"],
    options: { cwd, env, shell: false },
  }),
  getStdinPayload: ({ script }) => `$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n$ProgressPreference = 'SilentlyContinue'\n${script}\n`,
}

const BashShell = {
  ..._PosixShell,
  getSpawnConfig: ({ env, cwd }) => ({ command: "bash", args: [], options: { cwd, env, shell: false } }),
}

const GitBash = (() => {
  let _cachedPath = ""

  const getPath = () => {
    if (!IS_WIN) return "bash"
    if (_cachedPath) return _cachedPath
    const basePaths = [
      "C:\\Program Files\\Git\\bin\\bash.exe",
      "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
      "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
      "C:\\Program Files (x86)\\Git\\usr\\bin\\bash.exe",
    ]
    const userProfilePaths = process.env.USERPROFILE
      ? [`${process.env.USERPROFILE}\\AppData\\Local\\Programs\\Git\\bin\\bash.exe`]
      : []
    const envPaths = (process.env.PATH || "")
      .split(path.delimiter)
      .filter(dir => dir.toLowerCase().includes("git"))
      .flatMap(dir => [path.join(dir, "bash.exe"), path.join(dir, "..", "bin", "bash.exe")])
    const foundPath = [...basePaths, ...userProfilePaths, ...envPaths].find(p => fs.existsSync(p))
    _cachedPath = foundPath ? `"${foundPath}"` : "bash.exe"
    return _cachedPath
  }

  return {
    ..._PosixShell,
    getSpawnConfig: ({ env, rawCwd }) => ({
      command: getPath(),
      args: [],
      options: { env, shell: true, cwd: rawCwd },
    }),
  }
})()

const Wsl = {
  ..._PosixShell,
  PATH_PREFIX: "/mnt",
  normalizePath: (p) => {
    if (!IS_WIN) return p || ""
    const posixPath = _PosixShell.normalizePath(p)
    return posixPath && !posixPath.startsWith(Wsl.PATH_PREFIX)
      ? Wsl.PATH_PREFIX + posixPath
      : posixPath
  },
  getSpawnConfig: ({ env, cwd, customEnv }) => ({
    command: "wsl",
    args: cwd ? ["--cd", cwd, "-e", "bash"] : ["-e", "bash"],
    options: {
      env: {
        ...env,
        WSL_UTF8: "1",
        WSLENV: [env.WSLENV, ...Object.keys(customEnv), "WSL_UTF8"].filter(Boolean).join(":"),
      },
      shell: false,
    },
  }),
  getStderrFilter: () => (str) => {
    if (str.includes("wsl:") || str.includes("\uFFFD")) {
      const ret = str.split(/\r?\n/).filter(line => !line.includes("wsl:") && !line.includes("\uFFFD")).join("\n").trim()
      return ret ? ret + "\n" : ""
    }
    return str
  },
}

const wrapFunction = (fn, wrapper) => (...args) => wrapper(fn, ...args)

const createProcessManager = () => {
  let child = null
  const terminate = () => {
    if (child && !child.killed) {
      try {
        child.kill()
      } catch (e) {
      }
    }
  }
  const run = (shell, cmd, opts = {}) => {
    terminate()
    const hooks = { ...(opts.hooks || {}) }
    let currentChild = null
    hooks.onExit = wrapFunction(hooks.onExit, (originalOnExit, payload) => {
      if (child === currentChild) child = null
      originalOnExit?.(payload)
    })
    currentChild = executeShell(shell, cmd, { ...opts, hooks })
    child = currentChild
  }
  return {
    get isRunning() {
      return child !== null
    },
    run,
    terminate,
  }
}

module.exports = {
  CmdShell, PowerShell, BashShell, GitBash, Wsl,
  executeShell, createProcessManager,
}
