class exportEnhancePlugin extends BasePlugin {
    beforeProcess = () => new Promise(resolve => {
        const until = () => this.utils.exportHelper.isAsync !== undefined
        const after = () => resolve(this.utils.exportHelper.isAsync ? undefined : this.utils.stopLoadPluginError)
        this.utils.loopDetector(until, after)
    })

    process = () => {
        this.utils.runtime.autoSaveConfig(this)
        this.enable = this.config.ENABLE
        this.regexp = new RegExp(`<img.*?src="(.*?)".*?>`, "gs")
        this.utils.exportHelper.register(this.fixedName, null, this.afterExportToHTML)
    }

    afterExportToHTML = async html => {
        if (!this.enable) {
            return html
        }

        const dirname = this.utils.getCurrentDirPath()
        const imageMap = this.config.DOWNLOAD_NETWORK_IMAGE ? (await this.downloadAllImage(html)) : {}
        const replaceFunc = async (origin, src) => {
            try {
                if (this.utils.isSpecialImage(src)) {
                    return origin
                }
                let imagePath
                if (this.utils.isNetworkImage(src)) {
                    if (!this.config.DOWNLOAD_NETWORK_IMAGE || !imageMap.hasOwnProperty(src)) {
                        return origin
                    }
                    imagePath = imageMap[src]
                } else {
                    imagePath = this.utils.Package.Path.resolve(dirname, decodeURIComponent(src))
                }
                const base64Data = await this.toBase64(imagePath)
                return origin.replace(src, base64Data)
            } catch (e) {
                console.error(`[${this.fixedName}] toBase64 error:`, e)
            }
            return origin
        }
        return this.utils.asyncReplaceAll(html, this.regexp, replaceFunc)
    }

    downloadAllImage = async html => {
        const imageMap = {} // map src to localFilePath, only for network image
        const srcList = [...html.matchAll(this.regexp)]
            .filter(match => match.length === 2 && this.utils.isNetworkImage(match[1]))
            .map(match => match[1])
        const chunks = this.utils.chunk(srcList, this.config.DOWNLOAD_THREADS)
        for (const chunk of chunks) {
            const promises = chunk.map(async src => {
                if (imageMap.hasOwnProperty(src)) return
                try {
                    const { ok, filepath } = await this.utils.downloadImage(src)
                    if (ok) {
                        imageMap[src] = filepath
                    }
                } catch (e) {
                    console.error("download image error:", e)
                }
            })
            await Promise.all(promises)
            await this.utils.sleep(100)
        }
        return imageMap
    }

    toBase64 = async imagePath => {
        const data = await this.utils.Package.Fs.promises.readFile(imagePath)
        // MIME type detection should use magic number checks or a dedicated library.
        // Manually checking magic numbers is impractical and a library adds too much overhead.
        // This uses a simplified approach. Modern browsers can often infer the subtype reliably.
        const prefix = data.slice(0, 5).toString()
        const mime = ["<svg", "<?xml"].some(e => prefix.startsWith(e)) ? "image/svg+xml" : "image"
        const base64 = data.toString("base64")
        return `data:${mime};base64,${base64}`
    }

    getDynamicActions = () => this.i18n.fillActions([
        { act_value: "toggle_enable", act_state: this.enable },
        { act_value: "toggle_download", act_state: this.config.DOWNLOAD_NETWORK_IMAGE },
    ])

    call = action => {
        if (action === "toggle_download") {
            this.config.DOWNLOAD_NETWORK_IMAGE = !this.config.DOWNLOAD_NETWORK_IMAGE
        } else if (action === "toggle_enable") {
            this.enable = !this.enable
        }
    }
}

module.exports = {
    plugin: exportEnhancePlugin
}
