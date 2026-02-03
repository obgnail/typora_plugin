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
        this.registerMods({
            glob: "fs-plus/node_modules/glob",
            minimatch: "fs-plus/node_modules/minimatch",
            jimp: this.utils.joinPath((File.isNode ? "./lib.asar" : "./lib") + "/jimp/browser/lib/jimp.min.js"),
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
