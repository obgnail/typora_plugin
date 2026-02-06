/**
 * typora_plugin is not a formally engineered project.
 * To maintain the independence of plugin, distributed dependencies are used.
 */
const path = require("path")
const esbuild = require("esbuild")

const ENV = {
    BUILD_DIR: __dirname,
    ROOT_DIR: path.dirname(path.dirname(__dirname)),
    SHARED_LIB_DIR: "plugin/global/core/lib",
}

const ESBUILD_OPTIONS = {
    bundle: true,
    minify: true,
    platform: "node",
    target: "node12.14",
    logLevel: "info",
    sourcemap: false,
}

const sharedLib = (entryFile) => {
    const name = path.basename(entryFile, path.extname(entryFile))
    return { entry: entryFile, out: `${ENV.SHARED_LIB_DIR}/${name}.js` }
}

const SHARED_LIBS_CONFIG = {
    "js-yaml": sharedLib("js-yaml.cjs"),
    "katex": sharedLib("katex.cjs"),
    "markdown-it": sharedLib("markdown-it.cjs"),
    "smol-toml": sharedLib("smol-toml.mjs"),
    "node-fetch-commonjs": sharedLib("node-fetch-commonjs.cjs"),
    "https-proxy-agent": sharedLib("https-proxy-agent.mjs"),
    "mdast": sharedLib("mdast.mjs"),
}

const CUSTOM_TASKS_CONFIG = {
    "node-json-rpc": {
        entry: "node-json-rpc.cjs",
        out: "plugin/json_rpc/node-json-rpc.js"
    },
    "md-padding": {
        entry: "md-padding.mjs",
        out: "plugin/md_padding/md-padding.min.js"
    },
    "aes-ecb": {
        entry: "aes-ecb.mjs",
        out: "plugin/cipher/aes-ecb.min.js"
    },
    "markmap": {
        entry: "markmap.mjs",
        out: "plugin/markmap/resource/markmap.min.js"
    },
    "abc": {
        entry: "abc.mjs",
        out: "plugin/custom/plugins/abc/abcjs-basic-min.js"
    },
    "marp-core": {
        entry: "marp-core.mjs",
        out: "plugin/custom/plugins/marp/marp-core.min.js"
    },
    "markdownlint": {
        entry: "markdownlint.mjs",
        out: "plugin/custom/plugins/markdownLint/markdownlint.min.js"
    },
    "markdownlint-rule-helpers": {
        entry: "markdownlint-rule-helpers.cjs",
        out: "plugin/custom/plugins/markdownLint/markdownlint-rule-helpers.min.js"
    },
}

function generateBuildData(configMap, isShared) {
    const tasks = {}
    const registry = {}
    Object.entries(configMap).forEach(([name, config]) => {
        if (!config.entry || !config.out) {
            throw new Error(`Invalid config for "${name}"`)
        }
        tasks[name] = {
            entryPoints: [path.join(ENV.BUILD_DIR, config.entry)],
            outfile: path.join(ENV.ROOT_DIR, config.out),
        }
        if (isShared) {
            registry[name] = config.out
        }
    })
    return { tasks, registry }
}

function resolveTasksToRun(args, allTasks) {
    const analyze = args.includes("--analyze")
    const taskNames = args.filter(arg => !arg.startsWith("--"))
    if (taskNames.length === 0) {
        return { tasks: Object.values(allTasks), names: ["ALL"], analyze }
    }
    const tasks = []
    const names = []
    taskNames.forEach(name => {
        if (allTasks[name]) {
            tasks.push(allTasks[name])
            names.push(name)
        } else {
            console.warn(`\x1b[33mWarning: Task "${name}" not found. Skipping.\x1b[0m`)
        }
    })
    return { tasks, names, analyze }
}

function createAliasPlugin(registry, currentOutfile) {
    return {
        name: "auto-external-alias",
        setup(build) {
            const sharedLibNames = Object.keys(registry)
            if (sharedLibNames.length === 0) return

            const libs = sharedLibNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
            const filter = new RegExp(`^(${libs})$`)
            build.onResolve({ filter }, (args) => {
                const libName = args.path
                const targetRelPath = registry[libName]
                const targetAbsPath = path.join(ENV.ROOT_DIR, targetRelPath)

                // If the file currently being compiled is the shared library itself, do not external it
                if (currentOutfile === targetAbsPath) return null

                const outputDir = path.dirname(currentOutfile)
                let relPath = path.relative(outputDir, targetAbsPath).split(path.sep).join("/")
                if (!relPath.startsWith(".")) {
                    relPath = "./" + relPath
                }
                return { path: relPath, external: true }
            })
        }
    }
}

async function build() {
    const sharedData = generateBuildData(SHARED_LIBS_CONFIG, true)
    const customData = generateBuildData(CUSTOM_TASKS_CONFIG, false)

    const globalRegistry = sharedData.registry
    const allTasks = { ...sharedData.tasks, ...customData.tasks }

    const cliArgs = process.argv.slice(2)
    const { tasks: tasksToRun, names: selectedNames, analyze } = resolveTasksToRun(cliArgs, allTasks)
    if (tasksToRun.length === 0) {
        console.error("\x1b[31mError: No valid tasks specified.\x1b[0m")
        process.exit(1)
    }

    console.log(`\x1b[36mTargets: ${selectedNames.join(", ")} (${tasksToRun.length} tasks)\x1b[0m`)
    if (analyze) console.log(`\x1b[35mMode: Analysis Enabled\x1b[0m`)
    console.time("Build Time")

    try {
        const promises = tasksToRun.map(async task => {
            const alias = createAliasPlugin(globalRegistry, task.outfile)
            const buildOptions = {
                ...ESBUILD_OPTIONS,
                ...task,
                plugins: [alias],
                metafile: analyze,
            }

            const result = await esbuild.build(buildOptions)
            if (analyze && result.metafile) {
                const text = await esbuild.analyzeMetafile(result.metafile)
                console.log(`\n\x1b[35m[Analysis: ${path.basename(task.outfile)}]\x1b[0m`)
                console.log(text)
            }

            return result
        })
        await Promise.all(promises)
        console.timeEnd("Build Time")
        console.log("\x1b[32m✔ Build success!\x1b[0m")
    } catch (err) {
        console.error("\x1b[31m✘ Build failed:\x1b[0m", err)
        process.exit(1)
    }
}

build()
