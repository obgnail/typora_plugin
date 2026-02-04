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
            "getos": "getos",  // New version only
            "hjson": "hjson",
            "iconv-lite": "iconv-lite",
            "jschardet": "jschardet",
            "jsonfile": "jsonfile",
            "native-reg": "native-reg",  // New version only
            "node-machine-id": "node-machine-id",  // New version only
            "spellchecker": "spellchecker",
            "fs-extra": "fs-extra",
            "electron-fetch": "electron-fetch",  // New version only

            "extract-zip": "extract-zip",
            "mkdirp": "extract-zip/node_modules/mkdirp",
            "yauzl": "extract-zip/node_modules/yauzl",

            "fs-plus": "fs-plus",
            "brace-expansion": "fs-plus/node_modules/brace-expansion",
            "glob": "fs-plus/node_modules/glob",
            "minimatch": "fs-plus/node_modules/minimatch",
            "underscore": "fs-plus/node_modules/underscore",
            "underscore-plus": "fs-plus/node_modules/underscore-plus",

            "lowdb": "lowdb",
            "lodash": "lowdb/node_modules/lodash",

            "vscode-ripgrep": "vscode-ripgrep",
            "debug": "vscode-ripgrep/node_modules/debug",
            "ms": "vscode-ripgrep/node_modules/ms",
            "https-proxy-agent": "vscode-ripgrep/node_modules/https-proxy-agent",  // New version only

            "md5": "raven/node_modules/md5",
            "uuid": "raven/node_modules/uuid",

            "jimp": this.utils.joinPath(libBase, "jimp/browser/lib/jimp.min.js"),
            'pdf-lib': this.utils.joinPath(libBase, "pdf/pdf-lib.min.js"),
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
