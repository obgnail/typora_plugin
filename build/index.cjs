/**
 * typora_plugin is not a formally engineered project.
 * To maintain the independence of plugin, distributed dependencies are used.
 */
const esbuild = require("esbuild")

const commonOptions = {
    bundle: true,
    minify: true,
    platform: "node",
    target: "es6",
    logLevel: "info",
}

const buildTasks = [
    {
        entryPoints: ["mdast.mjs"],
        outfile: "../plugin/global/core/lib/mdast.min.js",
    },
    {
        entryPoints: ["md-padding.mjs"],
        outfile: "../plugin/md_padding/md-padding.min.js",
    },
    {
      entryPoints: ["aes-ecb.cjs"],
      outfile: "../plugin/cipher/aes-ecb.min.js",
    },
    {
        entryPoints: ["abc.mjs"],
        outfile: "../plugin/custom/plugins/abc/abcjs-basic-min.js",
    },
    {
      entryPoints: ["marp.mjs"],
        outfile: "../plugin/custom/plugins/marp/marp.min.js",
    },
    {
        entryPoints: ["markdownlint.mjs"],
        outfile: "../plugin/custom/plugins/markdownLint/markdownlint.min.js",
    },
    {
        entryPoints: ["markdownlint-rule-math.cjs"],
        outfile: "../plugin/custom/plugins/markdownLint/MD101.js",
    },
]

Promise.all(buildTasks.map(task => {
    return esbuild.build({
        ...commonOptions,
        ...task,
    })
}))
    .then(() => {
        console.log("All esbuild packaging tasks have been successfully completed!")
    })
    .catch((err) => {
        console.error("esbuild error:", err)
        process.exit(1)
    })
