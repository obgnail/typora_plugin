/*
* 难点在于如何才能匹配到正确的 markdown 图片
* 1. 不可使用非贪婪匹配，否则 ![image](assets/image(1).png) 会匹配成 ![image](assets/image(1
* 2. 要使用贪婪匹配，然后使用)从后往前截断，逐个测试。
*    1. 比如内容为：![image](assets/image(1).png)123)456
*    2. 首先匹配成 ![image](assets/image(1).png)123)，检测文件assets/image(1).png)123是否存在
*    3. 若不存在，继续匹配成 ![image](assets/image(1).png)，检测文件assets/image(1).png是否存在，以此类推
* 3. 使用贪婪匹配会引入一个问题：一行最多只会匹配一个图片，之后的所有图片都会漏掉
*    1. 比如有两个图片放在同一行： ![test](./assets/test.png)![test2](./assets/test2.png)123
*    2. 匹配到：![test](./assets/test.png)![test2](./assets/test2.png)，检测文件 ./assets/test.png)![test2](./assets/test2.png 是否存在，发现不存在
*    3. 接着匹配到：![test](./assets/test.png)，检测文件./assets/test.png 是否存在，发现存在，返回。
*    4. 上述流程就导致遗漏了./assets/test2.png图片。
* 4. 解决方案：递归处理。
*    1. 当匹配到![test](./assets/test.png)后，将最开始的匹配内容截断为 )![test2](./assets/test2.png)
*    2. 递归处理新的内容
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
        const modal = {title: "提示", components: [{label: "此插件运行需要数秒到数十秒。", type: "p"}]};
        this.utils.modal(modal, this.run);
    }

    run = () => this.traverseDir(File.getMountFolder(), this.collect, this.operate)

    operate = () => {
        const _report = (nonExistInFile, nonExistInFolder) => {
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
        const _delete = (nonExistInFile, nonExistInFolder) => [...nonExistInFile].forEach(file => this.utils.Package.Fs.unlink(file, console.error))
        const _move = (nonExistInFile, nonExistInFolder) => {
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

        const nonExistInFile = new Set([...this.resources].filter(x => !this.resourcesInFile.has(x)));
        const nonExistInFolder = new Set([...this.resourcesInFile].filter(x => !this.resources.has(x)));
        this.resources.clear();
        this.resourcesInFile.clear();

        const operation = {"report": _report, "delete": _delete, "move": _move}[this.config.operation];
        operation && operation(nonExistInFile, nonExistInFolder);
    }

    collect = async (filePath, dir) => {
        const {readFile} = this.utils.Package.Fs.promises;
        const {resolve, extname} = this.utils.Package.Path;

        const getRealPath = async imagePath => {
            let idx = imagePath.lastIndexOf(")");
            while (idx !== -1) {
                const exist = await this.utils.existPath(imagePath);
                if (exist) {
                    return imagePath;
                } else {
                    imagePath = imagePath.slice(0, idx);
                    idx = imagePath.lastIndexOf(")");
                }
            }
            return imagePath;
        }

        const collectMatch = async content => {
            for (const match of content.matchAll(this.regexp)) {
                let src = match.groups.src1 || match.groups.src2;
                if (!src || this.utils.isNetworkImage(src) || this.utils.isSpecialImage(src)) continue;

                try {
                    src = decodeURI(src).split("?")[0];
                } catch (e) {
                    console.warn("error path:", src);
                    continue
                }

                src = resolve(dir, src);
                if (this.resourcesInFile.has(src)) return;

                const resourcePath = await getRealPath(src);
                this.resourcesInFile.add(resourcePath);

                const remain = src.slice(resourcePath.length);
                if (remain) {
                    await collectMatch(remain + ")");
                }
            }
        }

        const ext = extname(filePath).toLowerCase();
        if (this.resourceSuffix.has(ext)) {
            this.resources.add(filePath);
            return
        }
        if (!this.fileSuffix.has(ext)) return;

        const buffer = await readFile(filePath);
        await collectMatch(buffer.toString());
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