const { describe, it } = require("node:test")
const assert = require("node:assert")
const engine = require("../../plugin/commander/engine.js")

const { RAW_SHELL_REGISTRY, SHELL_REGISTRY, executeShell, createProcessManager } = engine
const IS_WIN = process.platform === "win32"

// A POSIX-safe shell entry that exists on every platform this suite targets: `sh`/`bash` on
// posix, `cmd/bash` on Windows. We pick whichever entry is actually registered for this OS.
const nativeShellId = IS_WIN ? "cmd/bash" : "sh"
const nativeShell = SHELL_REGISTRY[nativeShellId]

describe("commander/engine.js - Shell Registry", () => {
  it("RAW_SHELL_REGISTRY contains every declared shell id regardless of platform support", () => {
    const expectedIds = ["cmd/bash", "sh", "zsh", "powershell", "gitbash", "wsl", "nushell", "python", "nodejs", "r", "julia"]
    for (const id of expectedIds) {
      assert.ok(Object.hasOwn(RAW_SHELL_REGISTRY, id), `RAW_SHELL_REGISTRY should contain "${id}"`)
      assert.strictEqual(typeof RAW_SHELL_REGISTRY[id].label, "string")
      assert.strictEqual(typeof RAW_SHELL_REGISTRY[id].executor, "object")
    }
  })

  it("SHELL_REGISTRY only contains entries whose `supported` check passes on the current platform", () => {
    if (IS_WIN) {
      assert.ok(Object.hasOwn(SHELL_REGISTRY, "cmd/bash"))
      assert.ok(Object.hasOwn(SHELL_REGISTRY, "powershell"))
      assert.ok(Object.hasOwn(SHELL_REGISTRY, "wsl"))
      assert.ok(!Object.hasOwn(SHELL_REGISTRY, "sh"))
      assert.ok(!Object.hasOwn(SHELL_REGISTRY, "zsh"))
    } else {
      assert.ok(Object.hasOwn(SHELL_REGISTRY, "cmd/bash"))
      assert.ok(Object.hasOwn(SHELL_REGISTRY, "sh"))
      assert.ok(Object.hasOwn(SHELL_REGISTRY, "zsh"))
      assert.ok(!Object.hasOwn(SHELL_REGISTRY, "powershell"))
      assert.ok(!Object.hasOwn(SHELL_REGISTRY, "wsl"))
    }
    // shells with no `supported` predicate are unconditionally available
    assert.ok(Object.hasOwn(SHELL_REGISTRY, "nushell"))
    assert.ok(Object.hasOwn(SHELL_REGISTRY, "python"))
    assert.ok(Object.hasOwn(SHELL_REGISTRY, "nodejs"))
    assert.ok(Object.hasOwn(SHELL_REGISTRY, "r"))
    assert.ok(Object.hasOwn(SHELL_REGISTRY, "julia"))
  })

  it("gitbash is only registered on Windows when a bash.exe path is discoverable", () => {
    if (!IS_WIN) {
      assert.ok(!Object.hasOwn(SHELL_REGISTRY, "gitbash"))
    }
    // On Windows the presence depends on the actual filesystem/env, so we only assert the
    // raw registry always has the definition available.
    assert.ok(Object.hasOwn(RAW_SHELL_REGISTRY, "gitbash"))
  })

  it("every registered executor exposes normalizePath, formatEnvVar and getSpawnConfig", () => {
    for (const [id, entry] of Object.entries(SHELL_REGISTRY)) {
      const executor = entry.executor
      assert.strictEqual(typeof executor.normalizePath, "function", `${id}.normalizePath`)
      assert.strictEqual(typeof executor.formatEnvVar, "function", `${id}.formatEnvVar`)
      assert.strictEqual(typeof executor.getSpawnConfig, "function", `${id}.getSpawnConfig`)
    }
  })
})

describe("commander/engine.js - baseShellMixin / posixShellMixin behavior (via registered shells)", () => {
  it("nodejs shell (baseShellMixin) normalizePath passes paths through unchanged, falsy -> ''", () => {
    const { executor } = SHELL_REGISTRY.nodejs
    assert.strictEqual(executor.normalizePath("/some/path"), "/some/path")
    assert.strictEqual(executor.normalizePath(""), "")
    assert.strictEqual(executor.normalizePath(null), "")
    assert.strictEqual(executor.normalizePath(undefined), "")
  })

  it("nodejs shell formatEnvVar formats process.env access", () => {
    const { executor } = SHELL_REGISTRY.nodejs
    assert.strictEqual(executor.formatEnvVar("FOO"), "process.env['FOO']")
  })

  it("sh/zsh (posixShellMixin) normalizePath converts windows-style paths only on IS_WIN", () => {
    const { executor } = RAW_SHELL_REGISTRY.sh
    if (IS_WIN) {
      assert.strictEqual(executor.normalizePath("C:\\Users\\me"), "/c/Users/me")
      assert.strictEqual(executor.normalizePath("D:\\a\\b"), "/d/a/b")
    } else {
      assert.strictEqual(executor.normalizePath("/a/b"), "/a/b")
    }
    assert.strictEqual(executor.normalizePath(""), "")
    assert.strictEqual(executor.normalizePath(null), "")
  })
})

describe("commander/engine.js - per-shell formatEnvVar", () => {
  const cases = [
    ["nushell", "FOO", "$env.FOO"],
    ["python", "FOO", "__import__(\"os\").environ.get('FOO')"],
    ["nodejs", "FOO", "process.env['FOO']"],
    ["r", "FOO", "Sys.getenv('FOO')"],
    ["julia", "FOO", "ENV[\"FOO\"]"],
  ]
  for (const [id, envName, expected] of cases) {
    it(`${id}.formatEnvVar produces the expected syntax`, () => {
      assert.strictEqual(RAW_SHELL_REGISTRY[id].executor.formatEnvVar(envName), expected)
    })
  }

  it("cmd/bash formatEnvVar differs between windows (%X%) and posix ($X, from baseShellMixin default)", () => {
    const { executor } = RAW_SHELL_REGISTRY["cmd/bash"]
    if (IS_WIN) {
      assert.strictEqual(executor.formatEnvVar("FOO"), "%FOO%")
    } else {
      assert.strictEqual(executor.formatEnvVar("FOO"), "$FOO")
    }
  })

  it("powershell formatEnvVar uses $env: prefix", () => {
    assert.strictEqual(RAW_SHELL_REGISTRY.powershell.executor.formatEnvVar("FOO"), "$env:FOO")
  })
})

describe("commander/engine.js - getSpawnConfig per shell", () => {
  it("cmd/bash getSpawnConfig on the current platform builds a valid command/args/options shape", () => {
    const { executor } = RAW_SHELL_REGISTRY["cmd/bash"]
    const config = executor.getSpawnConfig({ env: { FOO: "1" }, cwd: "/tmp" })
    assert.strictEqual(typeof config.command, "string")
    assert.ok(Array.isArray(config.args))
    assert.strictEqual(config.options.shell, false)
    assert.strictEqual(config.options.cwd, "/tmp")
    assert.strictEqual(config.options.env.FOO, "1")
    if (IS_WIN) {
      assert.strictEqual(config.command, "cmd")
      assert.deepStrictEqual(config.args, ["/Q", "/K", "@echo off & chcp 65001 >nul"])
    } else {
      assert.strictEqual(config.command, "bash")
      assert.deepStrictEqual(config.args, [])
    }
  })

  it("cmd/bash getStdinPayload (Windows branch) appends exit %errorlevel%", () => {
    const { executor } = RAW_SHELL_REGISTRY["cmd/bash"]
    if (IS_WIN) {
      assert.strictEqual(executor.getStdinPayload({ script: "echo hi" }), "echo hi\r\nexit %errorlevel%\r\n")
    } else {
      assert.strictEqual(executor.getStdinPayload, undefined)
    }
  })

  it("sh getSpawnConfig always uses shell:false and no extra args", () => {
    const { executor } = RAW_SHELL_REGISTRY.sh
    const config = executor.getSpawnConfig({ env: {}, cwd: "/tmp" })
    assert.strictEqual(config.command, "sh")
    assert.deepStrictEqual(config.args, [])
    assert.strictEqual(config.options.shell, false)
  })

  it("zsh getSpawnConfig mirrors sh but with the zsh binary", () => {
    const { executor } = RAW_SHELL_REGISTRY.zsh
    const config = executor.getSpawnConfig({ env: {}, cwd: "/tmp" })
    assert.strictEqual(config.command, "zsh")
  })

  it("powershell getSpawnConfig uses -NoProfile -NonInteractive -Command -", () => {
    const { executor } = RAW_SHELL_REGISTRY.powershell
    const config = executor.getSpawnConfig({ env: {}, cwd: "C:\\tmp" })
    assert.strictEqual(config.command, "powershell")
    assert.deepStrictEqual(config.args, ["-NoProfile", "-NonInteractive", "-Command", "-"])
    assert.strictEqual(config.options.shell, false)
  })

  it("powershell getStdinPayload sets UTF8 output encoding and silent progress preference", () => {
    const { executor } = RAW_SHELL_REGISTRY.powershell
    const payload = executor.getStdinPayload({ script: "Get-Date" })
    assert.match(payload, /OutputEncoding.*UTF8/)
    assert.match(payload, /ProgressPreference.*SilentlyContinue/)
    assert.match(payload, /Get-Date/)
  })

  it("gitbash getSpawnConfig uses shell:true and rawCwd (not normalized cwd)", () => {
    const { executor } = RAW_SHELL_REGISTRY.gitbash
    const config = executor.getSpawnConfig({ env: {}, rawCwd: "C:\\Users\\me" })
    assert.strictEqual(config.options.shell, true)
    assert.strictEqual(config.options.cwd, "C:\\Users\\me")
    assert.deepStrictEqual(config.args, [])
  })

  it("wsl normalizePath prefixes /mnt only on windows and only if not already prefixed", () => {
    const { executor } = RAW_SHELL_REGISTRY.wsl
    if (IS_WIN) {
      assert.strictEqual(executor.normalizePath("C:\\Users\\me"), "/mnt/c/Users/me")
      // posixShellMixin.normalizePath already returns a path starting with /mnt -> untouched
      assert.strictEqual(executor.normalizePath(""), "")
    } else {
      assert.strictEqual(executor.normalizePath("/a/b"), "/a/b")
    }
  })

  it("wsl getSpawnConfig switches between `--cd <cwd> -e bash` and `-e bash` depending on cwd", () => {
    const { executor } = RAW_SHELL_REGISTRY.wsl
    const withCwd = executor.getSpawnConfig({ env: {}, cwd: "/mnt/c/proj", customEnv: {} })
    assert.deepStrictEqual(withCwd.args, ["--cd", "/mnt/c/proj", "-e", "bash"])
    const withoutCwd = executor.getSpawnConfig({ env: {}, cwd: "", customEnv: {} })
    assert.deepStrictEqual(withoutCwd.args, ["-e", "bash"])
  })

  it("wsl getSpawnConfig injects WSL_UTF8=1 and builds WSLENV from customEnv keys", () => {
    const { executor } = RAW_SHELL_REGISTRY.wsl
    const config = executor.getSpawnConfig({ env: { WSLENV: "EXISTING" }, cwd: "", customEnv: { FOO: "1", BAR: "2" } })
    assert.strictEqual(config.options.env.WSL_UTF8, "1")
    assert.strictEqual(config.options.env.WSLENV, "EXISTING:FOO:BAR:WSL_UTF8")
    assert.strictEqual(config.options.shell, false)
  })

  it("wsl getSpawnConfig omits leading colon in WSLENV when env.WSLENV is empty/undefined", () => {
    const { executor } = RAW_SHELL_REGISTRY.wsl
    const config = executor.getSpawnConfig({ env: {}, cwd: "", customEnv: { FOO: "1" } })
    assert.strictEqual(config.options.env.WSLENV, "FOO:WSL_UTF8")
  })

  it("wsl getStderrFilter strips lines containing 'wsl:' or the replacement character", () => {
    const { executor } = RAW_SHELL_REGISTRY.wsl
    const filter = executor.getStderrFilter()
    assert.strictEqual(filter("normal output\n"), "normal output\n")
    assert.strictEqual(filter("wsl: some warning\nreal output\n"), "real output\n")
    assert.strictEqual(filter("wsl: only warning\n"), "")
    assert.strictEqual(filter("bad\uFFFDchar\nclean line\n"), "clean line\n")
  })

  it("nushell getSpawnConfig passes the script as -c argument and getStdinPayload returns empty string", () => {
    const { executor } = RAW_SHELL_REGISTRY.nushell
    const config = executor.getSpawnConfig({ env: {}, cwd: "/tmp", script: "ls" })
    assert.strictEqual(config.command, "nu")
    assert.deepStrictEqual(config.args, ["-c", "ls"])
    assert.strictEqual(executor.getStdinPayload(), "")
  })

  it("python getSpawnConfig forces PYTHONIOENCODING=utf-8 and uses `-u -`", () => {
    const { executor } = RAW_SHELL_REGISTRY.python
    const config = executor.getSpawnConfig({ env: { FOO: "1" }, cwd: "/tmp" })
    assert.strictEqual(config.command, "python")
    assert.deepStrictEqual(config.args, ["-u", "-"])
    assert.strictEqual(config.options.env.PYTHONIOENCODING, "utf-8")
    assert.strictEqual(config.options.env.FOO, "1")
  })

  it("r getSpawnConfig uses Rscript --vanilla -", () => {
    const { executor } = RAW_SHELL_REGISTRY.r
    const config = executor.getSpawnConfig({ env: {}, cwd: "/tmp" })
    assert.strictEqual(config.command, "Rscript")
    assert.deepStrictEqual(config.args, ["--vanilla", "-"])
  })

  it("julia getSpawnConfig disables startup file and color output", () => {
    const { executor } = RAW_SHELL_REGISTRY.julia
    const config = executor.getSpawnConfig({ env: {}, cwd: "/tmp" })
    assert.strictEqual(config.command, "julia")
    assert.deepStrictEqual(config.args, ["--startup-file=no", "--color=no"])
  })
})

describe("commander/engine.js - executeShell (real process spawning)", () => {
  it("resolves stdout via onStdout hook and calls onExit with code 0 on success", async () => {
    await new Promise((resolve, reject) => {
      let stdout = ""
      executeShell(nativeShell.executor, IS_WIN ? "echo hello" : "echo hello", {
        cwd: process.cwd(),
        timeout: 5000,
        hooks: {
          onStdout: (data) => stdout += data,
          onStderr: () => undefined,
          onExit: ({ code, error }) => {
            try {
              assert.ok(stdout.includes("hello"))
              assert.strictEqual(code, 0)
              assert.strictEqual(error, null)
              resolve()
            } catch (e) {
              reject(e)
            }
          },
        },
      })
    })
  })

  it("captures stderr output via onStderr hook", async () => {
    if (IS_WIN) return // stderr redirection syntax differs on cmd; skip cross-platform ambiguity
    await new Promise((resolve, reject) => {
      let stderr = ""
      executeShell(nativeShell.executor, "echo err-message 1>&2", {
        cwd: process.cwd(),
        timeout: 5000,
        hooks: {
          onStderr: (data) => stderr += data,
          onExit: ({ code }) => {
            try {
              assert.ok(stderr.includes("err-message"))
              assert.strictEqual(code, 0)
              resolve()
            } catch (e) {
              reject(e)
            }
          },
        },
      })
    })
  })

  it("passes a non-zero exit code and an Error to onExit when the command fails", async () => {
    if (IS_WIN) return
    await new Promise((resolve, reject) => {
      executeShell(nativeShell.executor, "exit 7", {
        cwd: process.cwd(),
        timeout: 5000,
        hooks: {
          onExit: ({ code, error }) => {
            try {
              assert.strictEqual(code, 7)
              assert.ok(error instanceof Error)
              assert.match(error.message, /exited with code 7/)
              resolve()
            } catch (e) {
              reject(e)
            }
          },
        },
      })
    })
  })

  it("kills the process on timeout and reports a signal-based error", async () => {
    if (IS_WIN) return
    await new Promise((resolve, reject) => {
      executeShell(nativeShell.executor, "sleep 5", {
        cwd: process.cwd(),
        timeout: 100,
        hooks: {
          onExit: ({ code, error }) => {
            try {
              assert.strictEqual(code, null)
              assert.ok(error instanceof Error)
              assert.match(error.message, /Timeout/)
              resolve()
            } catch (e) {
              reject(e)
            }
          },
        },
      })
    }).then(
      () => undefined,
      (e) => {
        throw e
      },
    )
  }, { timeout: 3000 })

  it("passes cwd through to the spawned process's working directory", async () => {
    if (IS_WIN) return
    await new Promise((resolve, reject) => {
      let stdout = ""
      executeShell(nativeShell.executor, "pwd", {
        cwd: "/tmp",
        hooks: {
          onStdout: (data) => stdout += data,
          onExit: () => {
            try {
              assert.match(stdout.trim(), /\/tmp$/)
              resolve()
            } catch (e) {
              reject(e)
            }
          },
        },
      })
    })
  })

  it("supports a function-valued cwd option (lazily evaluated)", async () => {
    if (IS_WIN) return
    await new Promise((resolve, reject) => {
      let stdout = ""
      executeShell(nativeShell.executor, "pwd", {
        cwd: () => "/tmp",
        hooks: {
          onStdout: (data) => stdout += data,
          onExit: () => {
            try {
              assert.match(stdout.trim(), /\/tmp$/)
              resolve()
            } catch (e) {
              reject(e)
            }
          },
        },
      })
    })
  })

  it("supports a function-valued envVars option receiving normalizePath, merged into process env", async () => {
    if (IS_WIN) return
    await new Promise((resolve, reject) => {
      let stdout = ""
      executeShell(nativeShell.executor, "echo $MY_CUSTOM_VAR", {
        cwd: process.cwd(),
        envVars: (normalizePath) => ({ MY_CUSTOM_VAR: normalizePath("hello-env") }),
        hooks: {
          onStdout: (data) => stdout += data,
          onExit: () => {
            try {
              assert.match(stdout, /hello-env/)
              resolve()
            } catch (e) {
              reject(e)
            }
          },
        },
      })
    })
  })

  it("supports a plain-object envVars option", async () => {
    if (IS_WIN) return
    await new Promise((resolve, reject) => {
      let stdout = ""
      executeShell(nativeShell.executor, "echo $PLAIN_VAR", {
        cwd: process.cwd(),
        envVars: { PLAIN_VAR: "plain-value" },
        hooks: {
          onStdout: (data) => stdout += data,
          onExit: () => {
            try {
              assert.match(stdout, /plain-value/)
              resolve()
            } catch (e) {
              reject(e)
            }
          },
        },
      })
    })
  })

  it("trims the command script before execution", async () => {
    if (IS_WIN) return
    await new Promise((resolve, reject) => {
      let stdout = ""
      executeShell(nativeShell.executor, "   echo trimmed   \n\n", {
        cwd: process.cwd(),
        hooks: {
          onStdout: (data) => stdout += data,
          onExit: () => {
            try {
              assert.match(stdout, /trimmed/)
              resolve()
            } catch (e) {
              reject(e)
            }
          },
        },
      })
    })
  })
})

describe("commander/engine.js - createProcessManager", () => {
  it("isRunning is false before any command runs", () => {
    const manager = createProcessManager()
    assert.strictEqual(manager.isRunning, false)
  })

  it("terminate() is a no-op when nothing is running", () => {
    const manager = createProcessManager()
    assert.doesNotThrow(() => manager.terminate())
  })

  it("isRunning becomes true while a command executes and false again after exit", async () => {
    if (IS_WIN) return
    const manager = createProcessManager()
    await new Promise((resolve) => {
      manager.run(nativeShell.executor, "sleep 0.2", {
        cwd: process.cwd(),
        hooks: {
          onExit: () => {
            assert.strictEqual(manager.isRunning, false)
            resolve()
          },
        },
      })
      assert.strictEqual(manager.isRunning, true)
    })
  })

  it("run() terminates any previously running process before starting a new one", async () => {
    if (IS_WIN) return
    const manager = createProcessManager()
    const firstExit = new Promise((resolve) => {
      manager.run(nativeShell.executor, "sleep 5", {
        cwd: process.cwd(),
        hooks: { onExit: (payload) => resolve(payload) },
      })
    })

    await new Promise(r => setTimeout(r, 50))

    const secondExit = new Promise((resolve) => {
      manager.run(nativeShell.executor, "echo second", {
        cwd: process.cwd(),
        hooks: { onExit: (payload) => resolve(payload) },
      })
    })

    const [first, second] = await Promise.all([firstExit, secondExit])
    // first process should have been killed (non-zero/null code), second should exit cleanly
    assert.notStrictEqual(first.code, 0)
    assert.strictEqual(second.code, 0)
  })

  it("terminate() stops the currently running process and isRunning becomes false", async () => {
    if (IS_WIN) return
    const manager = createProcessManager()
    await new Promise((resolve) => {
      manager.run(nativeShell.executor, "sleep 5", {
        cwd: process.cwd(),
        hooks: {
          onExit: () => {
            assert.strictEqual(manager.isRunning, false)
            resolve()
          },
        },
      })
      setTimeout(() => manager.terminate(), 50)
    })
  })

  it("does not leak the previous manager state across independent createProcessManager() instances", () => {
    const m1 = createProcessManager()
    const m2 = createProcessManager()
    assert.strictEqual(m1.isRunning, false)
    assert.strictEqual(m2.isRunning, false)
  })
})
