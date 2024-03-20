/*
* 此插件的难点在于如何才能匹配到正确的 markdown 图片
* 比如 ![image](assets/image (30).png) ，使用正则很容易匹配成 ![image](assets/image (30
* 此时需要使用贪婪匹配，然后逐个匹配
*/
class resourceOperation extends BaseCustomPlugin {
    selector = () => this.utils.getFilePath() ? undefined : this.utils.nonExistSelector
    hint = isDisable => isDisable && "空白页不可使用此插件"

    init = () => {
        this.regexp = this.config.ignore_image_div
            ? new RegExp("!\\[.*?\\]\\((?<src1>.*)\\)", "g")
            : new RegExp("!\\[.*?\\]\\((?<src1>.*)\\)|<img.*?src=\"(?<src2>.*?)\"", "g")

        this.resourceSuffix = new Set(this.config.resource_suffix);
        this.fileSuffix = new Set(this.config.markdown_suffix);
        this.resources = new Set();
        this.resourcesInFile = new Set();

        if (this.config.append_empty_suffix_file) {
            this.resourceSuffix.add("");
        }
    }

    callback = anchorNode => {
        const modal = {title: "提示", components: [{label: "此插件运行需要数秒到数十秒，请稍等。", type: "p"}]};
        this.utils.modal(modal, this.run);
    }

    run = () => this.traverseDir(File.getMountFolder(), this.traverseCallback, this.traverseThen)

    report = (nonExistInFile, nonExistInFolder) => {
        const template = (file, idx) => this.config.use_md_syntax_in_report ? `| ![resource${idx}](${file}) |` : `| \`${file}\` |`
        const _nonExistInFile = Array.from(nonExistInFile, template);
        const _nonExistInFolder = Array.from(nonExistInFolder, template);
        const fileContent = `## 存在于文件夹，但是不存在于 md 文件的资源(共${_nonExistInFile.length}项)\n\n| 资源名 |\n| ------ |\n${_nonExistInFile.join("\n")}\n\n
## 存在于 md 文件，但是不存在于文件夹的资源(共${_nonExistInFolder.length}项)\n\n| 资源名 |\n| ------ |\n${_nonExistInFolder.join("\n")}`;

        const filepath = this.utils.Package.Path.join(this.utils.getCurrentDirPath(), "resource-report.md");
        this.utils.Package.Fs.writeFileSync(filepath, fileContent, "utf8");
        if (this.config.auto_open) {
            this.utils.openFile(filepath);
            const datatablePlugin = this.utils.getPlugin("datatables");
            if (datatablePlugin && this.config.auto_use_datetable) {
                setTimeout(() => {
                    if (this.utils.getFilePath() === filepath) {
                        document.querySelectorAll("#write table").forEach(table => datatablePlugin.newDataTable(table));
                    }
                }, 500)
            }
        }
    }

    delete = (nonExistInFile, nonExistInFolder) => [...nonExistInFile].forEach(file => this.utils.Package.Fs.unlink(file, console.error))

    move = (nonExistInFile, nonExistInFolder) => {
        const {dirname, join, basename} = this.utils.Package.Path;
        const {mkdir, rename} = this.utils.Package.Fs;

        const dir = join(dirname(this.utils.getFilePath()), "resources-dest");
        mkdir(dir, err => {
            if (err) {
                console.error(err);
            } else {
                [...nonExistInFile].forEach(file => rename(file, join(dir, basename(file)), console.error));
            }
        });
    }

    traverseThen = () => {
        const nonExistInFile = new Set([...this.resources].filter(x => !this.resourcesInFile.has(x)));
        const nonExistInFolder = new Set([...this.resourcesInFile].filter(x => !this.resources.has(x)));

        const operation = {"report": this.report, "delete": this.delete, "move": this.move}[this.config.operation];
        operation && operation(nonExistInFile, nonExistInFolder);

        this.resources.clear();
        this.resourcesInFile.clear();
    }

    traverseCallback = async (filePath, dir) => {
        const extname = this.utils.Package.Path.extname(filePath).toLowerCase();
        if (this.resourceSuffix.has(extname)) {
            this.resources.add(filePath);
            return
        }
        if (!this.fileSuffix.has(extname)) return;

        const {access, readFile, constants: {R_OK, W_OK}} = this.utils.Package.Fs.promises;
        const getRealPath = async imagePath => {
            let idx = imagePath.lastIndexOf(")");
            while (idx !== -1) {
                try {
                    await access(imagePath, R_OK | W_OK);
                    return imagePath;
                } catch {
                    imagePath = imagePath.slice(0, idx);
                    idx = imagePath.lastIndexOf(")");
                }
            }
            return imagePath;
        }

        const buffer = await readFile(filePath);
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
                const resourcePath = await getRealPath(src);
                this.resourcesInFile.add(resourcePath);
            }
        }
    }

    traverseDir = (dir, callback, then) => {
        const {Fs: {promises: {readdir, stat}}, Path: {join}} = this.utils.Package;

        async function traverse(dir) {
            const files = await readdir(dir);
            for (const file of files) {
                const filePath = join(dir, file);
                const stats = await stat(filePath);
                if (stats.isFile()) {
                    await callback(filePath, dir)
                } else if (stats.isDirectory()) {
                    await traverse(filePath);
                }
            }
        }

        traverse(dir).then(then).catch(console.error);
    }
}

module.exports = {
    plugin: resourceOperation,
};