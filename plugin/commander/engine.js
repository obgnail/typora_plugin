const fs = require("fs")
const path = require("path")
const { spawn, execSync } = require("child_process")

const IS_WIN = process.platform === "win32"

function _normalizeVars(cmd, vars, formatEnvVarFn) {
  cmd = cmd.trim()
  if (vars.length === 0) return cmd
  const pattern = [...vars]
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
  child.stdout?.setEncoding("utf8")
  child.stderr?.setEncoding("utf8")
  child.stdout?.on("data", data => {
    if (data) hooks.onStdout?.(data)
  })
  child.stderr?.on("data", data => {
    const ret = stderrFilterFn ? stderrFilterFn(data) : data
    if (ret) hooks.onStderr?.(ret)
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
  if (payload) child.stdin.write(payload)
  child.stdin.end()
  return child
}

const wrapFunction = (fn, wrapper) => (...args) => wrapper(fn, ...args)

const createProcessManager = () => {
  let child = null
  const terminate = () => {
    if (!child || child.killed) return
    try {
      if (IS_WIN) execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" })
      else child.kill()
    } catch (e) {
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

const baseShellMixin = {
  normalizePath: (p) => p || "",
  formatEnvVar: (envName) => `$${envName}`,
}

const posixShellMixin = {
  ...baseShellMixin,
  normalizePath: (p) => (p && IS_WIN)
    ? p.replace(/\\/g, "/").replace(/^(\w+):/, (_, drive) => `/${drive.toLowerCase()}`)
    : (p || ""),
}

const RAW_SHELL_REGISTRY = {}
const SHELL_REGISTRY = {}

function register({ id, label, supported, factory }) {
  const context = { baseShellMixin, posixShellMixin, IS_WIN, process, fs, path }
  RAW_SHELL_REGISTRY[id] = { label, executor: factory(context) }

  const isSupported = typeof supported === "function"
    ? supported(context)
    : typeof supported === "boolean" ? supported : true
  if (isSupported) {
    SHELL_REGISTRY[id] = RAW_SHELL_REGISTRY[id]
  }
}

register({
  id: "cmd/bash",
  label: "CMD/Bash",
  factory: ({ IS_WIN, baseShellMixin, posixShellMixin }) => {
    return IS_WIN
      ? {
        ...baseShellMixin,
        formatEnvVar: (envName) => `%${envName}%`,
        getSpawnConfig: ({ env, cwd }) => ({
          command: "cmd",
          args: ["/Q", "/K", "@echo off & chcp 65001 >nul"],
          options: { cwd, env, shell: false },
        }),
        getStdinPayload: ({ script }) => `${script}\r\nexit %errorlevel%\r\n`,
      }
      : {
        ...posixShellMixin,
        getSpawnConfig: ({ env, cwd }) => ({
          command: "bash",
          args: [],
          options: { cwd, env, shell: false },
        }),
      }
  },
})

register({
  id: "sh",
  label: "SH",
  supported: ({ IS_WIN }) => !IS_WIN,
  factory: ({ posixShellMixin }) => ({
    ...posixShellMixin,
    getSpawnConfig: ({ env, cwd }) => ({
      command: "sh",
      args: [],
      options: { cwd, env, shell: false },
    }),
  }),
})

register({
  id: "zsh",
  label: "Zsh",
  supported: ({ IS_WIN }) => !IS_WIN,
  factory: ({ posixShellMixin }) => ({
    ...posixShellMixin,
    getSpawnConfig: ({ env, cwd }) => ({
      command: "zsh",
      args: [],
      options: { cwd, env, shell: false },
    }),
  }),
})

register({
  id: "powershell",
  label: "PowerShell",
  supported: ({ IS_WIN }) => IS_WIN,
  factory: ({ baseShellMixin }) => ({
    ...baseShellMixin,
    formatEnvVar: (envName) => `$env:${envName}`,
    getSpawnConfig: ({ env, cwd }) => ({
      command: "powershell",
      args: ["-NoProfile", "-NonInteractive", "-Command", "-"],
      options: { cwd, env, shell: false },
    }),
    getStdinPayload: ({ script }) => `$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8\n$ProgressPreference = 'SilentlyContinue'\n${script}\n`,
  }),
})

const _getGitBashPath = (() => {
  let cachedPath = null
  return ({ IS_WIN, fs, path, process }) => {
    if (!IS_WIN) return "bash"
    if (cachedPath !== null) return cachedPath

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
    cachedPath = foundPath ? `"${foundPath}"` : ""
    return cachedPath
  }
})()

register({
  id: "gitbash",
  label: "GitBash",
  supported: (ctx) => ctx.IS_WIN && !!_getGitBashPath(ctx),
  factory: (ctx) => ({
    ...ctx.posixShellMixin,
    getSpawnConfig: ({ env, rawCwd }) => ({
      command: _getGitBashPath(ctx) || "bash.exe",
      args: [],
      options: { cwd: rawCwd, env, shell: true },
    }),
  }),
})

register({
  id: "wsl",
  label: "WSL",
  supported: ({ IS_WIN }) => IS_WIN,
  factory: ({ IS_WIN, posixShellMixin }) => {
    const PATH_PREFIX = "/mnt"
    return {
      ...posixShellMixin,
      normalizePath: (p) => {
        if (!IS_WIN) return p || ""
        const posixPath = posixShellMixin.normalizePath(p)
        return posixPath && !posixPath.startsWith(PATH_PREFIX)
          ? PATH_PREFIX + posixPath
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
  },
})

register({
  id: "nushell",
  label: "Nushell",
  factory: ({ baseShellMixin }) => ({
    ...baseShellMixin,
    formatEnvVar: (envName) => `$env.${envName}`,
    getSpawnConfig: ({ env, cwd, script }) => ({
      command: "nu",
      args: ["-c", script],
      options: { cwd, env, shell: false },
    }),
    getStdinPayload: () => "",
  }),
})

register({
  id: "python",
  label: "Python",
  factory: ({ baseShellMixin }) => ({
    ...baseShellMixin,
    formatEnvVar: (envName) => `__import__("os").environ.get('${envName}')`,
    getSpawnConfig: ({ env, cwd }) => ({
      command: "python",
      args: ["-u", "-"],
      options: {
        cwd,
        env: { ...env, PYTHONIOENCODING: "utf-8" },
        shell: false,
      },
    }),
  }),
})

register({
  id: "nodejs",
  label: "Node.js",
  factory: ({ baseShellMixin }) => ({
    ...baseShellMixin,
    formatEnvVar: (envName) => `process.env['${envName}']`,
    getSpawnConfig: ({ env, cwd }) => ({
      command: "node",
      args: [],
      options: { cwd, env, shell: false },
    }),
  }),
})

register({
  id: "r",
  label: "R",
  factory: ({ baseShellMixin }) => ({
    ...baseShellMixin,
    formatEnvVar: (envName) => `Sys.getenv('${envName}')`,
    getSpawnConfig: ({ env, cwd }) => ({
      command: "Rscript",
      args: ["--vanilla", "-"],
      options: { cwd, env, shell: false },
    }),
  }),
})

register({
  id: "julia",
  label: "Julia",
  factory: ({ baseShellMixin }) => ({
    ...baseShellMixin,
    formatEnvVar: (envName) => `ENV["${envName}"]`,
    getSpawnConfig: ({ env, cwd }) => ({
      command: "julia",
      args: ["--startup-file=no", "--color=no"],
      options: { cwd, env, shell: false },
    }),
  }),
})

module.exports = { RAW_SHELL_REGISTRY, SHELL_REGISTRY, executeShell, createProcessManager }
