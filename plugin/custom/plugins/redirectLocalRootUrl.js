class RedirectLocalRootUrlPlugin extends BaseCustomPlugin {
    beforeProcess = () => this.config.root ? undefined : this.utils.stopLoadPluginError

    init = () => {
        this.filterRegex = this.config.filter_regexp ? new RegExp(this.config.filter_regexp) : undefined
    }

    needRedirect = (filePath = this.utils.getFilePath()) => this.filterRegex ? this.filterRegex.test(filePath) : true

    process = () => {
        const redirect = (rootUrl) => {
            const dontRedirect = !!rootUrl || !this.needRedirect()
            return dontRedirect ? rootUrl : this.utils.Package.Path.resolve(this.utils.getCurrentDirPath(), this.config.root)
        }
        this.utils.decorate(() => File?.editor?.docMenu, "getLocalRootUrl", null, redirect, true)

        this.utils.eventHub.once(this.utils.eventHub.eventType.fileOpened, () => File.editor.imgEdit.refreshLocalImg(true))
    }
}

module.exports = {
    plugin: RedirectLocalRootUrlPlugin
}
