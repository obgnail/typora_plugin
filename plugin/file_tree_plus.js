class FileTreePlusPlugin extends BasePlugin {
    beforeProcess = () => {
        if (!File?.SupportedFiles) {
            return this.utils.stopLoadPluginError
        }
        File.SupportedFiles.push(...this.config.SUPPORTED_FILE_EXT)
    }

    process = () => {
        const supportedExt = new Set(this.config.SUPPORTED_FILE_EXT.map(e => `.${e}`))
        // Delay decoration to ensure this beforeFn runs first, this beforeFn may return a stopCallError
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
            this.utils.decorate(() => File?.editor?.library, "openFile", (toOpenFile) => {
                const ext = this.utils.Package.Path.extname(toOpenFile)
                if (supportedExt.has(ext)) {
                    this.utils.openPath(toOpenFile)
                    return this.utils.stopCallError
                }
            })
        })
    }
}

module.exports = {
    plugin: FileTreePlusPlugin
}
