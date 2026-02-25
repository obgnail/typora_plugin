/**
 * typora_plugin is not a formally engineered project.
 * To maintain the independence of plugin, distributed dependencies are used.
 */
const path = require("path")
const fs = require("fs-extra")
const esbuild = require("esbuild")
const { minimatch } = require("minimatch")

const ENV = {
    BUILD_DIR: __dirname,
    DEVELOP_DIR: path.dirname(__dirname),
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

const sharedLib = (entry, assets = []) => {
    const name = path.basename(entry, path.extname(entry))
    const out = assets.length > 0
        ? `${ENV.SHARED_LIB_DIR}/${name}/${name}.js`
        : `${ENV.SHARED_LIB_DIR}/${name}.js`
    return { entry, out, assets }
}

const SHARED_LIBS_CONFIG = {
    "js-yaml": sharedLib("js-yaml.cjs"),
    "markdown-it": sharedLib("markdown-it.cjs"),
    "smol-toml": sharedLib("smol-toml.mjs"),
    "node-fetch-commonjs": sharedLib("node-fetch-commonjs.cjs"),
    "https-proxy-agent": sharedLib("https-proxy-agent.mjs"),
    "micromark": sharedLib("micromark.mjs"),
    "mdast": sharedLib("mdast.mjs"),
    "katex": sharedLib("katex.cjs", [
        { src: "node_modules/katex/dist/katex.min.css", dst: "katex.min.css" },
        { src: "node_modules/katex/dist/fonts", dst: "fonts", pattern: "*.woff2" },
    ]),
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
        out: "plugin/abc/abcjs-basic-min.js"
    },
    "marp-core": {
        entry: "marp-core.mjs",
        out: "plugin/marp/marp-core.min.js"
    },
    "markdownlint": {
        entry: "markdownlint.mjs",
        out: "plugin/markdownlint/markdownlint.min.js"
    },
    "markdownlint-rule-helpers": {
        entry: "markdownlint-rule-helpers.cjs",
        out: "plugin/markdownlint/markdownlint-rule-helpers.min.js"
    },
}

function generateBuildData(configMap, isShared) {
    const tasks = {}
    const registry = {}
    Object.entries(configMap).forEach(([name, config]) => {
        if (!config.entry || !config.out) {
            throw new Error(`Invalid config for "${name}"`)
        }

        const entryPoints = [path.join(ENV.BUILD_DIR, config.entry)]
        const outfile = path.join(ENV.ROOT_DIR, config.out)
        const assets = (config.assets || []).map(asset => ({
            ...asset,
            srcAbs: path.join(ENV.DEVELOP_DIR, asset.src),
            dstAbs: path.join(path.dirname(outfile), asset.dst)
        }))
        tasks[name] = { entryPoints, outfile, assets }
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

async function copyAssets(assets) {
    await Promise.all(assets.map(async (asset) => {
        const filterFn = (currentSrc) => {
            return (!asset.pattern || fs.statSync(currentSrc).isDirectory())
                ? true
                : minimatch(path.relative(asset.srcAbs, currentSrc), asset.pattern, { matchBase: true })
        }
        return fs.copy(asset.srcAbs, asset.dstAbs, { overwrite: true, filter: filterFn })
    }))
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
        await Promise.all(tasksToRun.map(async task => {
            const { assets, ...taskConfig } = task
            const alias = createAliasPlugin(globalRegistry, task.outfile)
            const buildOptions = {
                ...ESBUILD_OPTIONS,
                ...taskConfig,
                plugins: [alias],
                metafile: analyze,
            }

            const result = await esbuild.build(buildOptions)
            if (analyze && result.metafile) {
                const text = await esbuild.analyzeMetafile(result.metafile)
                console.log(`\n\x1b[35m[Analysis: ${path.basename(task.outfile)}]\x1b[0m`)
                console.log(text)
            }

            if (assets && assets.length > 0) {
                await copyAssets(assets)
            }

            return result
        }))
        console.timeEnd("Build Time")
        console.log("\x1b[32m✔ Build success!\x1b[0m")
    } catch (err) {
        console.error("\x1b[31m✘ Build failed:\x1b[0m", err)
        process.exit(1)
    }
}

build()
