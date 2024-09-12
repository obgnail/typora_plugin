class exportEnhancePlugin extends BasePlugin {
    beforeProcess = () => new Promise(resolve => {
        const until = () => this.utils.exportHelper.isAsync !== undefined;
        const after = () => resolve(this.utils.exportHelper.isAsync ? undefined : this.utils.stopLoadPluginError);
        this.utils.loopDetector(until, after)
    })

    process = () => {
        this.regexp = new RegExp(`<img.*?src="(.*?)".*?>`, "gs");
        this.utils.exportHelper.register("export_enhance", null, this.afterExport);
    }

    afterExport = async html => {
        if (!this.config.ENABLE) return html;

        const imageMap = this.config.DOWNLOAD_NETWORK_IMAGE ? await this.downloadAllImage(html) : {};
        const dirname = this.utils.getCurrentDirPath();

        return this.utils.asyncReplaceAll(html, this.regexp, async (origin, src) => {
            try {
                if (this.utils.isSpecialImage(src)) return origin;

                let imagePath;
                if (this.utils.isNetworkImage(src)) {
                    if (!this.config.DOWNLOAD_NETWORK_IMAGE || !imageMap.hasOwnProperty(src)) return origin;
                    imagePath = imageMap[src];
                } else {
                    imagePath = this.utils.Package.Path.resolve(dirname, decodeURIComponent(src));
                }

                const base64Data = await this.toBase64(imagePath);
                return origin.replace(src, base64Data);
            } catch (e) {
                console.error("toBase64 error:", e);
            }
            return origin;
        })
    }

    downloadAllImage = async html => {
        const imageMap = {}; // map src to localFilePath, use for network image only
        const matches = Array.from(html.matchAll(this.regexp));
        const chunkList = this.utils.chunk(matches, this.config.DOWNLOAD_THREADS);
        for (const list of chunkList) {
            await Promise.all(list.map(async match => {
                if (match.length !== 2 || !this.utils.isNetworkImage(match[1]) || imageMap.hasOwnProperty(match[1])) return;

                const src = match[1];
                try {
                    const { ok, filepath } = await this.utils.downloadImage(src);
                    if (ok) {
                        imageMap[src] = filepath;
                    }
                } catch (e) {
                    console.error("download image error:", e);
                }
            }))
        }
        return imageMap;
    }

    toBase64 = async imagePath => {
        const bitmap = await this.utils.Package.Fs.promises.readFile(imagePath);
        const data = Buffer.from(bitmap).toString('base64');
        return `data:image;base64,${data}`;
    }

    dynamicCallArgsGenerator = () => [
        { arg_name: "启用导出增强", arg_value: "toggle_enable", arg_state: this.config.ENABLE },
        { arg_name: "下载网络图片", arg_value: "toggle_download", arg_state: this.config.DOWNLOAD_NETWORK_IMAGE },
    ]

    call = type => {
        if (type === "toggle_download") {
            this.config.DOWNLOAD_NETWORK_IMAGE = !this.config.DOWNLOAD_NETWORK_IMAGE
        } else if (type === "toggle_enable") {
            this.config.ENABLE = !this.config.ENABLE
        }
    }
}

module.exports = {
    plugin: exportEnhancePlugin
};