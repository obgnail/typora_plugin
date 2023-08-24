/*
* 此插件的难点在于如何才能匹配到正确的 markdown 图片
* 比如 ![image](assets/image (30).png) ，使用正则很容易匹配成 ![image](assets/image (30
* 此时需要使用贪婪匹配，然后逐个匹配
*/
class resourceOperation extends BaseCustomPlugin {
    selector = () => ""
    init = () => {
        if (this.config.ignore_image_div) {
            this.regexp = new RegExp("!\\[.*?\\]\\((?<src1>.*)\\)", "g");
        } else {
            this.regexp = new RegExp("!\\[.*?\\]\\((?<src1>.*)\\)|<img.*?src=\"(?<src2>.*?)\"", "g");
        }

        this.resourceSuffix = new Set([".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".bmp", ".mp3", ".mp4", ".image", ".jfif", ".gif!large"]);
        this.fileSuffix = new Set([".md", ".markdown", ".mdown", ".mmd", ".rmarkdown", ".mkd", ".mdwn", ".mdtxt", ".rmd", ".mdtext"]);

        if (this.config.append_empty_suffix_file) {
            this.resourceSuffix.add("");
        }
    }

    callback = anchorNode => {
        this.resources = new Set();
        this.resourcesInFile = new Set();
        this.traverseDir(File.getMountFolder(), this.traverseCallback, this.traverseThen);
    }

    report = (nonExistInFile, nonExistInFolder) => {
        const _nonExistInFile = [...nonExistInFile].map(this.template);
        const _nonExistInFolder = [...nonExistInFolder].map(this.template);
        const fileContent = `## 存在于文件夹，但是不存在于 md 文件的资源(共${_nonExistInFile.length}项)\n\n| 资源名 |\n| ------ |\n${_nonExistInFile.join("\n")}\n\n
## 存在于 md 文件，但是不存在于文件夹的资源(共${_nonExistInFolder.length}项)\n\n| 资源名 |\n| ------ |\n${_nonExistInFolder.join("\n")}`;

        const filepath = this.utils.Package.Path.join(this.utils.Package.Path.dirname(this.utils.getFilePath()), "resource-report.md");
        this.utils.Package.Fs.writeFileSync(filepath, fileContent, "utf8");
        if (this.config.auto_open) {
            this.utils.openFile(filepath);

            const datatables = this.utils.getPlugin("datatables");
            if (datatables && this.config.auto_use_datetable) {
                setTimeout(() => {
                    if (this.utils.getFilePath() === filepath) {
                        document.querySelectorAll("#write table").forEach(table => datatables.newDataTable(table));
                    }
                }, 500)
            }
        }
    }

    traverseThen = () => {
        const nonExistInFile = new Set([...this.resources].filter(x => !this.resourcesInFile.has(x)));
        const nonExistInFolder = new Set([...this.resourcesInFile].filter(x => !this.resources.has(x)));
        this.report(nonExistInFile, nonExistInFolder);

        // 避免占用内存
        this.resources = new Set();
        this.resourcesInFile = new Set();
    }

    traverseCallback = async (filePath, dir) => {
        if (filePath[0] === ".") return;

        const extname = this.utils.Package.Path.extname(filePath).toLowerCase();
        if (this.resourceSuffix.has(extname)) {
            this.resources.add(filePath);
            return
        }

        if (this.fileSuffix.has(extname)) {
            const buffer = await this.utils.Package.Fs.promises.readFile(filePath);
            const content = buffer.toString();
            for (const result of content.matchAll(this.regexp)) {
                let src = result.groups.src1 || result.groups.src2;
                if (!src || this.utils.isNetworkImage(src)) continue;

                try {
                    src = decodeURI(src).split("?")[0];
                } catch (e) {
                    console.error("error path:", src);
                    continue
                }

                src = this.utils.Package.Path.resolve(dir, src);
                if (!this.resourcesInFile.has(src)) {
                    const resourcePath = await this.getRealPath(src);
                    this.resourcesInFile.add(resourcePath);
                }
            }
        }
    }

    traverseDir = (dir, callback, then) => {
        const pkg = this.utils.Package;

        async function traverse(dir) {
            const files = await pkg.Fs.promises.readdir(dir);
            for (const file of files) {
                const filePath = pkg.Path.join(dir, file);
                const stats = await pkg.Fs.promises.stat(filePath);
                if (stats.isFile()) {
                    await callback(filePath, dir)
                } else if (stats.isDirectory()) {
                    await traverse(filePath);
                }
            }
        }

        traverse(dir).then(then).catch(err => console.error(err));
    }

    template = (file, idx) => {
        if (this.config.use_md_syntax_in_report) {
            return `| ![resource${idx}](${file}) |`
        } else {
            return `| ${file} |`
        }
    }

    getRealPath = async (imagePath) => {
        const access = this.utils.Package.Fs.promises.access;
        const constants = this.utils.Package.Fs.promises.constants;

        let idx = imagePath.lastIndexOf(")");
        while (idx !== -1) {
            try {
                await access(imagePath, constants.R_OK | constants.W_OK);
                break
            } catch {
                imagePath = imagePath.slice(0, idx);
                idx = imagePath.lastIndexOf(")");
            }
        }
        return new Promise(resolve => resolve(imagePath))
    }
}

module.exports = {
    plugin: resourceOperation,
};