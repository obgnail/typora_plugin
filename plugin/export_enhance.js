(() => {
    const config = global._pluginUtils.getPluginSetting("export_enhance");
    const Path = global._pluginUtils.Package.Path;
    const tempFolder = global._pluginUtils.tempFolder;

    const isNetworkImage = src => /^https?|(ftp):\/\//.test(src);

    const getDirname = () => {
        const filepath = global._pluginUtils.getFilePath();
        return Path.dirname(filepath)
    }

    const toBase64 = imagePath => {
        const bitmap = global._pluginUtils.Package.Fs.readFileSync(imagePath);
        const data = Buffer.from(bitmap).toString('base64');
        return `data:image;base64,${data}`;
    }

    const newPromise = result => new Promise(resolve => resolve(result))

    const decoMixin = {
        regexp: new RegExp(`<img.*?src="(.*?)".*?>`, "gs"),
        writeIdx: -1,
        imageMap: {}, // map src to localFileName

        downloadAllImage: async (html) => {
            decoMixin.imageMap = {}
            for (let result of html.matchAll(decoMixin.regexp)) {
                if (result.length !== 2 || result.index < decoMixin.writeIdx || !isNetworkImage(result[1])) continue
                const src = result[1];
                const filename = Math.random() + "_" + Path.basename(src);
                const {state} = await JSBridge.invoke("app.download", src, tempFolder, filename);
                if (state === "completed") {
                    decoMixin.imageMap[src] = filename;
                }
            }
        },

        afterExportToHtml: async (exportResult, ...args) => {
            decoMixin.writeIdx = -1;
            const exportConfig = args[0];
            if (!exportConfig || exportConfig["type"] !== "html" && exportConfig["type"] !== "html-plain") return exportResult;

            const html = await exportResult;
            decoMixin.writeIdx = html.indexOf(`id='write'`);
            if (decoMixin.writeIdx === -1) return newPromise(html);

            if (config.ENABLE_NETWORK_IMAGE) {
                await decoMixin.downloadAllImage(html)
            }

            const dirname = getDirname();
            const newHtml = html.replace(decoMixin.regexp, (origin, src, srcIdx) => {
                if (srcIdx < decoMixin.writeIdx) return origin;

                let result = origin;
                let imagePath;
                try {
                    if (isNetworkImage(src)) {
                        if (!config.ENABLE_NETWORK_IMAGE || !decoMixin.imageMap.hasOwnProperty(src)) return origin
                        const path = decoMixin.imageMap[src];
                        imagePath = Path.join(tempFolder, path);
                    } else {
                        imagePath = Path.join(dirname, src);
                    }
                    const base64Data = toBase64(imagePath);
                    result = origin.replace(src, base64Data);
                } catch (e) {
                    console.log("export error:", e);
                }
                return result;
            })
            return newPromise(newHtml);
        }
    }

    global._pluginUtils.decorate(
        () => (File && File.editor && File.editor.export && File.editor.export.exportToHTML),
        File.editor.export,
        "exportToHTML",
        null,
        decoMixin.afterExportToHtml,
        true,
    );
    console.log("export_enhance.js had been injected");
})()