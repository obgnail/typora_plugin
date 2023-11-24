class redirectLocalRootUrlPlugin extends BaseCustomPlugin {
    process = () => {
        if (!this.config.root) return
        const regexp = new RegExp(this.config.filter_regexp);
        const redirect = typoraRootUrl => {
            if (typoraRootUrl || (this.config.filter_regexp && !regexp.test(this.utils.getFilePath()))) {
                return typoraRootUrl
            } else {
                return this.utils.Package.Path.resolve(this.utils.getCurrentDirPath(), this.config.root)
            }
        }
        this.utils.decorate(() => File && File.editor && File.editor.docMenu, "getLocalRootUrl", null, redirect, true)
    }
}

module.exports = {
    plugin: redirectLocalRootUrlPlugin
};