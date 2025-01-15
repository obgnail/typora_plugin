class redirectLocalRootUrlPlugin extends BaseCustomPlugin {
    beforeProcess = () => {
        if (!this.config.root) {
            return this.utils.stopLoadPluginError
        }
    }

    init = () => {
        const { filter_regexp } = this.config
        this.filter = filter_regexp ? new RegExp(filter_regexp) : undefined
    }

    needRedirect = (filepath = this.utils.getFilePath()) => {
        return this.filter ? this.filter.test(filepath) : true
    }

    process = () => {
        const redirect = typoraRootUrl => {
            const dontRedirect = typoraRootUrl || !this.needRedirect()
            return dontRedirect
                ? typoraRootUrl
                : this.utils.Package.Path.resolve(this.utils.getCurrentDirPath(), this.config.root)
        }
        this.utils.decorate(() => File && File.editor && File.editor.docMenu, "getLocalRootUrl", null, redirect, true)
    }
}

module.exports = {
    plugin: redirectLocalRootUrlPlugin
}
