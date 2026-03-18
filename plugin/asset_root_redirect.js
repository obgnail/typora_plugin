class AssetRootRedirectPlugin extends BasePlugin {
    beforeProcess = () => this.config.ROOT_PATH ? undefined : this.utils.PLUGIN_LOAD_ABORT

    init = () => {
        const { Minimatch } = this.utils.unstableRequire("minimatch")
        this.ignoreMatches = this.config.IGNORE_GLOB_FILES.map(f => new Minimatch(f))
    }

    process = () => {
        this.utils.eventHub.once(this.utils.eventHub.eventType.fileOpened, () => File.editor.imgEdit.refreshLocalImg(true))
        this.utils.decorator.modifyReturn(() => File?.editor?.docMenu, "getLocalRootUrl", (rootUrl) => {
            return (rootUrl || !this.needRedirect(this.utils.getFilePath()))
                ? rootUrl
                : this._resolveRootURL(this.utils.getCurrentDirPath())
        })
    }

    needRedirect = (mdPath) => !this.ignoreMatches.some(m => m.match(mdPath))

    getRootURL = (md, mdPath, mdDir) => {
        const { yamlObject } = this.utils.splitFrontMatter(md)
        const rootUrl = yamlObject?.["typora-root-url"]
        if (rootUrl) {
            return rootUrl
        }
        if (this.needRedirect(mdPath)) {
            return this._resolveRootURL(mdDir)
        }
        return null
    }

    _resolveRootURL = (mdDir) => this.utils.Package.Path.resolve(mdDir, this.config.ROOT_PATH)
}

module.exports = {
    plugin: AssetRootRedirectPlugin
}
