class exportEnhancePlugin extends global._basePlugin {
    init = () => {
        this.Path = this.utils.Package.Path;
        this.tempFolder = this.utils.tempFolder; // i‘d like to shit here

        this.decoMixin = {
            regexp: new RegExp(`<img.*?src="(.*?)".*?>`, "gs"),
            writeIdx: -1,
            imageMap: {}, // map src to localFileName, use for network image only

            init: () => {
                this.decoMixin.writeIdx = -1
                this.decoMixin.imageMap = {}
            },

            downloadAllImage: async (html) => {
                for await (let result of html.matchAll(this.decoMixin.regexp)) {
                    if (result.length !== 2 || result.index < this.decoMixin.writeIdx || !this.isNetworkImage(result[1])) continue
                    const src = result[1];
                    if (!this.decoMixin.imageMap.hasOwnProperty(src)) { // single flight
                        const filename = Math.random() + "_" + this.Path.basename(src);
                        const {state} = JSBridge.invoke("app.download", src, this.tempFolder, filename);
                        if (state === "completed") {
                            this.decoMixin.imageMap[src] = filename;
                        }
                    }
                }
            },

            afterExportToHtml: async (exportResult, ...args) => {
                if (!this.config.ENABLE) return exportResult;

                this.decoMixin.init();

                const exportConfig = args[0];
                if (!exportConfig || exportConfig["type"] !== "html" && exportConfig["type"] !== "html-plain") return exportResult;

                const html = await exportResult;
                this.decoMixin.writeIdx = html.indexOf(`id='write'`);
                if (this.decoMixin.writeIdx === -1) return this.simplePromise(html);

                if (this.config.DOWNLOAD_NETWORK_IMAGE) {
                    await this.decoMixin.downloadAllImage(html)
                }

                const dirname = this.getCurDir();
                const newHtml = html.replace(this.decoMixin.regexp, (origin, src, srcIdx) => {
                    if (srcIdx < this.decoMixin.writeIdx) return origin;

                    let result = origin;
                    let imagePath;
                    try {
                        if (this.isNetworkImage(src)) {
                            if (!this.config.DOWNLOAD_NETWORK_IMAGE || !this.decoMixin.imageMap.hasOwnProperty(src)) return origin
                            const path = this.decoMixin.imageMap[src];
                            imagePath = this.Path.join(this.tempFolder, path);
                        } else {
                            imagePath = this.Path.join(dirname, src);
                        }
                        const base64Data = this.toBase64(imagePath);
                        result = origin.replace(src, base64Data);
                    } catch (e) {
                        console.log("export error:", e);
                    }
                    return result;
                })
                return this.simplePromise(newHtml);
            }
        }
    }

    process = () => {
        this.init();

        this.utils.decorate(
            () => (File && File.editor && File.editor.export && File.editor.export.exportToHTML),
            File.editor.export,
            "exportToHTML",
            null,
            this.decoMixin.afterExportToHtml,
            true,
        );
    }

    isNetworkImage = src => /^https?|(ftp):\/\//.test(src);

    getCurDir = () => {
        const filepath = this.utils.getFilePath();
        return this.Path.dirname(filepath)
    }

    toBase64 = imagePath => {
        const bitmap = this.utils.Package.Fs.readFileSync(imagePath);
        const data = Buffer.from(bitmap).toString('base64');
        return `data:image;base64,${data}`;
    }

    simplePromise = result => new Promise(resolve => resolve(result));

    dynamicCallArgsGenerator = () => {
        const call_args = [];
        if (this.config.DOWNLOAD_NETWORK_IMAGE) {
            call_args.push({arg_name: "导出HTML时不下载网络图片", arg_value: "dont_download_network_image"});
        } else {
            call_args.push({arg_name: "导出HTML时下载网络图片", arg_value: "download_network_image"});
        }
        if (this.config.ENABLE) {
            call_args.push({arg_name: "禁用", arg_value: "disable"});
        } else {
            call_args.push({arg_name: "启用", arg_value: "enable"})
        }

        return call_args
    }

    call = type => {
        if (type === "download_network_image") {
            this.config.DOWNLOAD_NETWORK_IMAGE = true
        } else if (type === "dont_download_network_image") {
            this.config.DOWNLOAD_NETWORK_IMAGE = false
        } else if (type === "disable") {
            this.config.ENABLE = false
        } else if (type === "enable") {
            this.config.ENABLE = true
        }
    }
}

module.exports = {
    plugin: exportEnhancePlugin
};