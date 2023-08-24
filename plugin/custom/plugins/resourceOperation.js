class resourceOperation extends BaseCustomPlugin {
    selector = () => ""
    init = () => {
        if (this.config.ignore_image_div) {
            this.regexp = new RegExp("!\\[.*?\\]\\((?<src1>.*?)\\)", "g");
        } else {
            this.regexp = new RegExp("!\\[.*?\\]\\((?<src1>.*?)\\)|<img.*?src=\"(?<src2>.*?)\"", "g");
        }

        this.resourceSuffix = new Set([".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".bmp", ".mp3", ".mp4", ".image", ".jfif", ".gif!large"]);
        this.fileSuffix = new Set([".md", ".markdown", ".mdown", ".mmd", ".rmarkdown", ".mkd", ".mdwn", ".mdtxt", ".rmd", ".mdtext"]);

        this.resources = new Set();
        this.resourcesInFile = new Set();

        this.message = "> Note: 存在一个已知 BUG: **如果资源路径中包含右括号，会出现匹配异常的情况**"
    }

    callback = anchorNode => this.traverseDir(File.getMountFolder(), this.traverseCallback, this.traverseThen);

    report = (nonExistInFile, nonExistInFolder) => {
        const _nonExistInFile = [...nonExistInFile].map(this.template);
        const _nonExistInFolder = [...nonExistInFolder].map(this.template);
        const fileContent = `${this.message}\n\n## 存在于文件夹，但是不存在于 md 文件的资源\n\n| 资源名 |\n| ------ |\n${_nonExistInFile.join("\n")}\n\n## 存在于 md 文件，但是不存在于文件夹的资源\n\n| 资源名 |\n| ------ |\n${_nonExistInFolder.join("\n")}`;

        const filepath = this.utils.newFilePath("resource-report.md");
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
        // console.log(this, nonExistInFile, nonExistInFolder);
        this.report(nonExistInFile, nonExistInFolder);
    }

    traverseCallback = async (filePath, dir) => {
        if (filePath[0] === ".") return;

        const extname = this.utils.Package.Path.extname(filePath).toLowerCase();
        if (this.resourceSuffix.has(extname)) {
            this.resources.add(filePath);
        } else if (this.fileSuffix.has(extname)) {
            const buffer = await this.utils.Package.Fs.promises.readFile(filePath);
            const content = buffer.toString();
            for (const result of content.matchAll(this.regexp)) {
                let src = result.groups.src1 || result.groups.src2;
                if (src && !this.utils.isNetworkImage(src)) {
                    try {
                        src = decodeURI(src).split("?")[0];
                    } catch (e) {
                        console.error("error path:", src);
                        continue
                    }
                    const resourcePath = this.getAbsPath(dir, src);
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

    getAbsPath = (dir, imagePath) => {
        if (this.utils.Package.Path.isAbsolute(imagePath)) {
            return imagePath
        } else {
            return this.utils.Package.Path.resolve(dir, imagePath);
        }
    }
}

module.exports = {
    plugin: resourceOperation,
};