const INVOKE_SYM = Symbol("invoke")

class UnstableRequire {
    constructor(utils) {
        const self = (...args) => self[INVOKE_SYM](...args)
        Object.setPrototypeOf(self, new.target.prototype)
        self.utils = utils
        self.mods = {}
        return self
    }

    process() {
        const libBase = File.isNode ? "./lib.asar" : "./lib"
        this.registerMods({
            "chokidar": "chokidar",
            "fs-extra": "fs-extra",
            "hjson": "hjson",
            "iconv-lite": "iconv-lite",
            "jschardet": "jschardet",
            "spellchecker": "spellchecker",

            "extract-zip": "extract-zip",
            "yauzl": "extract-zip/node_modules/yauzl",

            "fs-plus": "fs-plus",
            "glob": "fs-plus/node_modules/glob",
            "minimatch": "fs-plus/node_modules/minimatch",
            "underscore": "fs-plus/node_modules/underscore",
            "underscore-plus": "fs-plus/node_modules/underscore-plus",
            "brace-expansion": "fs-plus/node_modules/brace-expansion",

            "lowdb": "lowdb",
            "lodash": "lowdb/node_modules/lodash",

            "vscode-ripgrep": "vscode-ripgrep",
            "ms": "vscode-ripgrep/node_modules/ms",

            "md5": "raven/node_modules/md5",
            "uuid": "raven/node_modules/uuid",

            "jimp": this.utils.joinPath(libBase, "jimp/browser/lib/jimp.min.js"),
            "pdf-lib": this.utils.joinPath(libBase, "pdf/pdf-lib.min.js"),

            // New version only
            "getos": "getos",
            "native-reg": "native-reg",
            "electron-fetch": "electron-fetch",
            "node-machine-id": "node-machine-id",
            "debug": "vscode-ripgrep/node_modules/debug",
            "https-proxy-agent": "vscode-ripgrep/node_modules/https-proxy-agent",
        })
    }

    [INVOKE_SYM](id) {
        const mod = this.mods[id]
        if (!mod) {
            throw new Error(`[UnstableRequire] Package '${id}' is not defined.`)
        }
        return require(mod)
    }

    registerMods(mods) {
        this.mods = { ...this.mods, ...mods }
    }
}

module.exports = UnstableRequire
