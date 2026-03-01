/**
 * @fileoverview Custom build script for typora_plugin.
 * Orchestrates dependency fetching, asset copying, and source bundling via esbuild.
 * Designed to maintain plugin independence by distributing dependencies locally
 * rather than relying on a centralized node_modules directory at runtime.
 */
const path = require("path")
const fs = require("fs-extra")
const fetch = require("node-fetch-commonjs")
const esbuild = require("esbuild")
const { HttpsProxyAgent } = require("https-proxy-agent")
const { minimatch } = require("minimatch")
const { pipeline } = require("stream")
const { promisify } = require("util")

const DIR_BUILD = __dirname
const DIR_DEV = path.dirname(DIR_BUILD)
const DIR_ROOT = path.dirname(DIR_DEV)
const REL_DIR_SHARED_VENDOR = "plugin/global/core/lib"

const absPaths = {
    build: (...args) => path.join(DIR_BUILD, ...args),
    root: (...args) => path.join(DIR_ROOT, ...args),
    shared: (...args) => path.join(DIR_ROOT, REL_DIR_SHARED_VENDOR, ...args),
}

const relPaths = {
    shared: (...args) => path.join(REL_DIR_SHARED_VENDOR, ...args),
}

function getNpmRoot(pkgName) {
    try {
        return path.dirname(require.resolve(`${pkgName}/package.json`, { paths: [DIR_DEV] }))
    } catch {
        const directPath = path.join(DIR_DEV, "node_modules", pkgName)
        return fs.existsSync(directPath) ? directPath : null
    }
}

function resolveCopies(pkgName, outDirAbs, assets) {
    const pkgRoot = getNpmRoot(pkgName)
    if (!pkgRoot) {
        console.warn(`\x1b[33mWarning: Cannot resolve NPM package "${pkgName}". Assets skipped.\x1b[0m`)
        return []
    }
    if (Array.isArray(assets)) {
        return assets.map(a => ({
            absSrc: path.join(pkgRoot, a.npmSrc),
            absDest: path.join(outDirAbs, a.destName),
            pattern: a.pattern,
        }))
    }
    return Object.entries(assets).map(([destName, val]) => {
        const isStr = typeof val === "string"
        return {
            absSrc: path.join(pkgRoot, isStr ? val : val.npmSrc),
            absDest: path.join(outDirAbs, destName),
            pattern: isStr ? undefined : val.pattern,
        }
    })
}

const VENDOR_TYPE = { download: "download", bundle: "bundle", dist: "dist" }

const sharedVendor = {
    bundle: ({ entryInBuild, outFileName }) => ({
        type: VENDOR_TYPE.bundle,
        absEntry: absPaths.build(entryInBuild),
        absOut: absPaths.shared(outFileName),
        aliasTarget: relPaths.shared(outFileName),
    }),
    download: ({ url, outFileName }) => ({
        type: VENDOR_TYPE.download,
        downloads: [{ url, absOut: absPaths.shared(outFileName) }],
        aliasTarget: relPaths.shared(outFileName),
    }),
    copyNpm: ({ aliasTargetFileName, outDirName, pkgName, assets }) => ({
        type: VENDOR_TYPE.dist,
        absOut: absPaths.shared(outDirName, aliasTargetFileName),
        aliasTarget: relPaths.shared(outDirName, aliasTargetFileName),
        copies: resolveCopies(pkgName, absPaths.shared(outDirName), assets),
    })
}

const pluginVendor = {
    bundle: ({ entryInBuild, outFilePath, copyNpm }) => {
        const absOut = absPaths.root(outFilePath)
        return {
            type: VENDOR_TYPE.bundle,
            absEntry: absPaths.build(entryInBuild),
            absOut,
            copies: copyNpm ? resolveCopies(copyNpm.pkgName, path.dirname(absOut), copyNpm.assets) : []
        }
    },
    download: ({ files }) => ({
        type: VENDOR_TYPE.download,
        downloads: Object.entries(files).map(([outFilePath, url]) => ({ absOut: absPaths.root(outFilePath), url }))
    }),
    copyNpm: ({ pkgName, files }) => {
        const pkgRoot = getNpmRoot(pkgName)
        const copies = []
        let absOut = ""
        if (pkgRoot) {
            for (const [outFilePath, npmSrc] of Object.entries(files)) {
                const absDest = absPaths.root(outFilePath)
                if (!absOut) absOut = absDest
                copies.push({ absSrc: path.join(pkgRoot, npmSrc), absDest })
            }
        } else {
            console.warn(`\x1b[33mWarning: Cannot resolve NPM package "${pkgName}". Assets skipped.\x1b[0m`)
        }
        return { type: VENDOR_TYPE.dist, absOut, copies }
    }
}

const SHARED_VENDORS_CONFIG = {
    "js-yaml": sharedVendor.download({ outFileName: "js-yaml.js", url: "https://raw.githubusercontent.com/nodeca/js-yaml/refs/heads/master/dist/js-yaml.min.js" }),
    "markdown-it": sharedVendor.download({ outFileName: "markdown-it.js", url: "https://cdn.jsdelivr.net/npm/markdown-it@14.1.1/dist/markdown-it.min.js" }),
    "smol-toml": sharedVendor.bundle({ outFileName: "smol-toml.js", entryInBuild: "smol-toml.mjs" }),
    "node-fetch-commonjs": sharedVendor.bundle({ outFileName: "node-fetch-commonjs.js", entryInBuild: "node-fetch-commonjs.cjs" }),
    "https-proxy-agent": sharedVendor.bundle({ outFileName: "https-proxy-agent.js", entryInBuild: "https-proxy-agent.mjs" }),
    "micromark": sharedVendor.bundle({ outFileName: "micromark.js", entryInBuild: "micromark.mjs" }),
    "katex": sharedVendor.copyNpm({
        aliasTargetFileName: "katex.js",
        outDirName: "katex",
        pkgName: "katex",
        assets: {
            "katex.js": "dist/katex.min.js",
            "katex.min.css": "dist/katex.min.css",
            "fonts": { npmSrc: "dist/fonts", pattern: "*.woff2" },
        }
    }),
}

const PLUGIN_VENDORS_CONFIG = {
    "node-json-rpc": pluginVendor.bundle({ entryInBuild: "node-json-rpc.cjs", outFilePath: "plugin/json_rpc/node-json-rpc.js" }),
    "md-padding": pluginVendor.bundle({ entryInBuild: "md-padding.mjs", outFilePath: "plugin/md_padding/md-padding.min.js" }),
    "aes-ecb": pluginVendor.bundle({ entryInBuild: "aes-ecb.mjs", outFilePath: "plugin/cipher/aes-ecb.min.js" }),
    "markmap": pluginVendor.bundle({ entryInBuild: "markmap.mjs", outFilePath: "plugin/markmap/resource/markmap.min.js" }),
    "marp-core": pluginVendor.bundle({ entryInBuild: "marp-core.mjs", outFilePath: "plugin/marp/marp-core.min.js" }),
    "markdownlint": pluginVendor.bundle({ entryInBuild: "markdownlint.mjs", outFilePath: "plugin/markdownlint/markdownlint.min.js" }),
    "markdownlint-rule-helpers": pluginVendor.bundle({ entryInBuild: "markdownlint-rule-helpers.cjs", outFilePath: "plugin/markdownlint/markdownlint-rule-helpers.min.js" }),
    "calendar": pluginVendor.bundle({
        entryInBuild: "calendar.cjs",
        outFilePath: "plugin/calendar/toastui-calendar.min.js",
        copyNpm: {
            pkgName: "@toast-ui/calendar",
            assets: { "toastui-calendar.min.css": "dist/toastui-calendar.min.css" },
        }
    }),
    "abc": pluginVendor.copyNpm({ pkgName: "abcjs", files: { "plugin/abc/abcjs-basic-min.js": "dist/abcjs-basic-min.js" } }),
    "chart": pluginVendor.download({ files: { "plugin/chart/chart.min.js": "https://cdn.jsdelivr.net/npm/chart.js" } }),
    "echarts": pluginVendor.download({ files: { "plugin/echarts/echarts.min.js": "https://raw.githubusercontent.com/apache/echarts/refs/heads/master/dist/echarts.min.js" } }),
    "wavedrom": pluginVendor.download({ files: { "plugin/wavedrom/wavedrom.min.js": "https://cdnjs.cloudflare.com/ajax/libs/wavedrom/3.5.0/wavedrom.unpkg.min.js" } }),
    "dataTables": pluginVendor.download({
        files: {
            "plugin/datatables/resource/js/dataTables.min.js": "https://cdn.datatables.net/1.10.25/js/jquery.dataTables.min.js",
            "plugin/datatables/resource/css/dataTables.min.css": "https://cdn.datatables.net/1.10.25/css/jquery.dataTables.min.css",
            "plugin/datatables/resource/images/sort_asc.png": "https://cdn.datatables.net/1.10.25/images/sort_asc.png",
            "plugin/datatables/resource/images/sort_asc_disabled.png": "https://cdn.datatables.net/1.10.25/images/sort_asc_disabled.png",
            "plugin/datatables/resource/images/sort_both.png": "https://cdn.datatables.net/1.10.25/images/sort_both.png",
            "plugin/datatables/resource/images/sort_desc.png": "https://cdn.datatables.net/1.10.25/images/sort_desc.png",
            "plugin/datatables/resource/images/sort_desc_disabled.png": "https://cdn.datatables.net/1.10.25/images/sort_desc_disabled.png",
        }
    }),
}

const ESBUILD_OPTIONS = { bundle: true, minify: true, platform: "node", target: "node12.14", logLevel: "info", sourcemap: false }

async function copyAssets(copies) {
    if (!copies?.length) return
    await Promise.all(copies.map(async ({ absSrc, absDest, pattern }) => {
        const filterFn = async (currSrc) => {
            if (!pattern) return true
            return (await fs.stat(currSrc)).isDirectory() ? true : minimatch(path.relative(absSrc, currSrc), pattern, { matchBase: true })
        }
        return fs.copy(absSrc, absDest, { overwrite: true, filter: filterFn })
    }))
}

async function downloadFile(url, dest) {
    const env = process.env
    const proxy = env.http_proxy || env.HTTP_PROXY || env.https_proxy || env.HTTPS_PROXY
    const agent = proxy ? new HttpsProxyAgent(proxy) : undefined
    const response = await fetch(url, { agent })
    if (!response.ok) throw new Error(`Download failed for '${url}' (${response.status})`)

    await fs.ensureDir(path.dirname(dest))
    await promisify(pipeline)(response.body, fs.createWriteStream(dest))
}

function createAliasPlugin(registry, currentAbsOutfile) {
    return {
        name: "auto-external-alias",
        setup(build) {
            const sharedLibs = Object.keys(registry)
            if (!sharedLibs.length) return

            const regexPattern = sharedLibs.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
            build.onResolve({ filter: new RegExp(`^(${regexPattern})$`) }, (args) => {
                const targetAbsPath = absPaths.root(registry[args.path])
                if (currentAbsOutfile === targetAbsPath) return null

                let relPath = path.relative(path.dirname(currentAbsOutfile), targetAbsPath).split(path.sep).join("/")
                return { path: relPath.startsWith(".") ? relPath : `./${relPath}`, external: true }
            })
        }
    }
}

const vendorExecutors = {
    [VENDOR_TYPE.download]: async (vendor, { analyze }) => {
        await Promise.all(vendor.downloads.map(async task => {
            await downloadFile(task.url, task.absOut)
            if (analyze) console.log(`\n\x1b[35m[Downloaded: ${path.basename(task.absOut)}]\x1b[0m`)
        }))
    },
    [VENDOR_TYPE.bundle]: async (vendor, { analyze, aliasRegistry }) => {
        await copyAssets(vendor.copies)
        const result = await esbuild.build({
            ...ESBUILD_OPTIONS,
            entryPoints: [vendor.absEntry],
            outfile: vendor.absOut,
            plugins: [createAliasPlugin(aliasRegistry, vendor.absOut)],
            metafile: analyze
        })
        if (analyze && result.metafile) {
            console.log(`\n\x1b[35m[Analysis: ${path.basename(vendor.absOut)}]\x1b[0m`)
            console.log(await esbuild.analyzeMetafile(result.metafile))
        }
    },
    [VENDOR_TYPE.dist]: async (vendor, { analyze }) => {
        await copyAssets(vendor.copies)
        if (analyze) console.log(`\n\x1b[35m[Copied Assets Only: ${path.basename(vendor.absOut)}]\x1b[0m`)
    }
}

async function build() {
    const cliArgs = process.argv.slice(2)
    const analyze = cliArgs.includes("--analyze")
    const targetNames = cliArgs.filter(arg => !arg.startsWith("--"))

    const allVendors = {}
    const aliasRegistry = {}
    Object.entries(SHARED_VENDORS_CONFIG).forEach(([name, cfg]) => {
        allVendors[name] = { ...cfg, name }
        aliasRegistry[name] = cfg.aliasTarget
    })
    Object.entries(PLUGIN_VENDORS_CONFIG).forEach(([name, cfg]) => {
        allVendors[name] = { ...cfg, name }
    })

    const vendorsToRun = targetNames.length === 0
        ? Object.values(allVendors)
        : targetNames.map(name => {
            if (!allVendors[name]) console.warn(`\x1b[33mWarning: Vendor "${name}" not found. Skipping.\x1b[0m`)
            return allVendors[name]
        }).filter(Boolean)

    if (!vendorsToRun.length) {
        console.error("\x1b[31mError: No valid vendors specified.\x1b[0m")
        process.exit(1)
    }

    console.log(`\x1b[36mTargets: ${targetNames.length ? targetNames.join(", ") : "ALL"} (${vendorsToRun.length} vendors)\x1b[0m`)
    console.time("Build Time")

    try {
        await Promise.all(vendorsToRun.map(vendor => vendorExecutors[vendor.type](vendor, { analyze, aliasRegistry })))
        console.timeEnd("Build Time")
        console.log("\x1b[32m✔ Build success!\x1b[0m")
    } catch (err) {
        console.error("\x1b[31m✘ Build failed:\x1b[0m", err)
        process.exit(1)
    }
}

build()
