/**
 * typora_plugin is not a formally engineered project.
 * To maintain the independence of plugin, distributed dependencies are used.
 */
const path = require("path")
const esbuild = require("esbuild")

const options = {
    bundle: true,
    minify: true,
    platform: "node",
    target: "node12.14",
    logLevel: "info",
}

const allBuildTasks = {
    "markdown-it": {
        entryPoints: ["markdown-it.cjs"],
        outfile: "plugin/global/core/lib/markdown-it.js",
    },
    "smol-toml": {
        entryPoints: ["smol-toml.mjs"],
        outfile: "plugin/global/core/lib/smol-toml.js",
    },
    "mdast": {
        entryPoints: ["mdast.mjs"],
        outfile: "plugin/global/core/lib/mdast.js",
    },
    "https-proxy-agent": {
        entryPoints: ["https-proxy-agent.mjs"],
        outfile: "plugin/global/core/lib/https-proxy-agent.js",
    },
    "node-json-rpc": {
        entryPoints: ["node-json-rpc.cjs"],
        outfile: "plugin/json_rpc/node-json-rpc.js",
    },
    "md-padding": {
        entryPoints: ["md-padding.mjs"],
        outfile: "plugin/md_padding/md-padding.min.js",
    },
    "aes-ecb": {
        entryPoints: ["aes-ecb.mjs"],
        outfile: "plugin/cipher/aes-ecb.min.js",
    },
    "markmap": {
        entryPoints: ["markmap.mjs"],
        outfile: "plugin/markmap/resource/markmap.min.js",
    },
    "abc": {
        entryPoints: ["abc.mjs"],
        outfile: "plugin/custom/plugins/abc/abcjs-basic-min.js",
    },
    "marp-core": {
        entryPoints: ["marp-core.mjs"],
        outfile: "plugin/custom/plugins/marp/marp-core.min.js",
    },
    "markdownlint": {
        entryPoints: ["markdownlint.mjs"],
        outfile: "plugin/custom/plugins/markdownLint/markdownlint.min.js",
    },
    "markdownlint-rule-helpers": {
        entryPoints: ["markdownlint-rule-helpers.cjs"],
        outfile: "plugin/custom/plugins/markdownLint/markdownlint-rule-helpers.min.js",
    },
}

let tasksToBuild = []
const args = process.argv.slice(2)
if (args.length === 0) {
    tasksToBuild = Object.values(allBuildTasks)
    console.log("Building all dependencies...")
} else {
    args.forEach(taskName => {
        if (allBuildTasks[taskName]) {
            tasksToBuild.push(allBuildTasks[taskName])
            console.log(`Adding task: ${taskName}`)
        } else {
            console.warn(`Warning: Task "${taskName}" not found. Skipping.`)
        }
    })
}
if (tasksToBuild.length === 0) {
    console.error("No valid tasks specified. Please provide valid task names")
    process.exit(1)
}

const pluginDir = path.dirname(path.dirname(__dirname))

Promise.all(
    tasksToBuild
        .map(task => ({
            entryPoints: task.entryPoints.map(e => path.join(__dirname, e)),
            outfile: path.join(pluginDir, task.outfile)
        }))
        .map(task => esbuild.build({
            ...options,
            ...task,
        }))
)
    .then(() => {
        console.log("Selected packaging tasks have been successfully completed!")
    })
    .catch((err) => {
        console.error("Build Error:", err)
        process.exit(1)
    })
