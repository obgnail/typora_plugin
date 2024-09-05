/**
 * 难点在于如何才能匹配到正确的 markdown 图片
 * 1. 不可使用非贪婪匹配，否则 ![image](assets/image(1).png) 会匹配成 ![image](assets/image(1)
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
 * 5. 其实最好的方法应该是使用LR parser，但是我很怀疑JS的性能顶得住逐字符迭代的设计，尤其是要分析上千文件的情况（若单个文件5000字符，1000个文件就是五百万次循环），所以还是交给regexp处理，C++万岁
 */
class resourceOperationPlugin extends BaseCustomPlugin {
    selector = () => this.utils.getMountFolder() ? undefined : this.utils.nonExistSelector

    hint = isDisable => isDisable && "空白页不可使用此插件"

    styleTemplate = () => true

    hotkey = () => [this.config.hotkey]

    html = () => `
        <div id="plugin-resource-operation" class="plugin-common-modal plugin-common-hidden">
            <div class="plugin-resource-operation-icon-group">
                <div class="plugin-resource-operation-icon ion-close" action="close" ty-hint="关闭"></div>
                <div class="plugin-resource-operation-icon ion-arrow-move" action="move" ty-hint="移动"></div>
                <div class="plugin-resource-operation-icon ion-eye-disabled" action="togglePreview" ty-hint="预览图片"></div>
                <div class="plugin-resource-operation-icon ion-archive" action="download" ty-hint="下载报告"></div>
            </div>
            <img class="plugin-resource-operation-popup plugin-common-hidden">
            <div class="plugin-resource-operation-wrap"></div>
        </div>
    `

    init = () => {
        const { ignore_img_html_element, resource_suffix, markdown_suffix, collect_file_without_suffix } = this.config;
        this.regexp = ignore_img_html_element
            ? new RegExp("!\\[.*?\\]\\((?<src1>.*)\\)", "g")
            : new RegExp("!\\[.*?\\]\\((?<src1>.*)\\)|<img.*?src=\"(?<src2>.*?)\"", "g")
        this.resourceSuffixs = new Set(resource_suffix);
        this.fileSuffixs = new Set(markdown_suffix);
        this.resources = new Set();
        this.resourcesInFile = new Set();
        if (collect_file_without_suffix) {
            this.resourceSuffixs.add("");
        }
        this.nonExistInFile = null;
        this.nonExistInFolder = null;
        this.showWarnDialog = true;

        this.entities = {
            modal: document.querySelector("#plugin-resource-operation"),
            wrap: document.querySelector(".plugin-resource-operation-wrap"),
            popup: document.querySelector(".plugin-resource-operation-popup"),
            iconGroup: document.querySelector(".plugin-resource-operation-icon-group"),
            move: document.querySelector('.plugin-resource-operation-icon-group [action="move"]'),
            $wrap: $(".plugin-resource-operation-wrap"),
        }
    }

    process = () => {
        this.utils.dragFixedModal(this.entities.move, this.entities.modal, false);
        this.entities.iconGroup.addEventListener("click", ev => {
            const target = ev.target.closest("[action]");
            if (target) {
                const action = target.getAttribute("action");
                this[action] && this[action](ev);
            }
        })
        this.entities.wrap.addEventListener("click", async ev => {
            const target = ev.target.closest("button[action]");
            if (!target) return;
            const tr = target.closest("tr");
            if (!tr) return;
            const p = tr.querySelector(".plugin-resource-operation-src");
            if (!p) return;

            const src = p.dataset.path;
            const action = target.getAttribute("action");
            if (action === "delete") {
                if (this.showWarnDialog) {
                    const filename = this.utils.getFileName(src, false);
                    const checkboxLabel = "不再提示（直到关闭Typora）";
                    const option = { type: "warning", buttons: ["确定", "取消"], message: `是否删除文件 ${filename}`, checkboxLabel };
                    const { response, checkboxChecked } = await this.utils.showMessageBox(option);
                    if (response === 1) return;
                    if (checkboxChecked) {
                        this.showWarnDialog = false;
                    }
                }
                await this.utils.Package.Fs.promises.unlink(src);
                this.utils.removeElement(tr);
                this.nonExistInFile.delete(src);
            } else if (action === "locate") {
                this.utils.showInFinder(src);
            }
        })
    }

    callback = async anchorNode => await this.utils.withProcessingHint(this.run)

    run = async () => {
        await this.collectImage();
        this.initModalRect();
        this.initModalTable();
        this.utils.show(this.entities.modal);
    }

    initModalRect = (resetLeft = true) => {
        const { left, width, height } = this.utils.entities.eContent.getBoundingClientRect();
        const { modal_left_percent: l, modal_width_percent: w, modal_height_percent: h } = this.config;
        const style = { width: `${width * w / 100}px`, height: `${height * h / 100}px` };
        if (resetLeft) {
            style.left = `${left + width * l / 100}px`;
        }
        Object.assign(this.entities.modal.style, style);
    }

    initModalTable = () => {
        const output = this.getOutput();
        delete output.resource_non_exist_in_file;
        delete output.resource_non_exist_in_folder;
        const replacer = (key, value) => Array.isArray(value) ? value.join("|") : value
        const btnGroup = `<td><div class="btn-group"><button type="button" class="btn btn-default" action="locate">打开</button><button type="button" class="btn btn-default" action="delete">删除</button></div></td>`
        const nonExistInFile = Array.from(this.nonExistInFile, (row, idx) => `<tr><td>${idx + 1}</td><td class="plugin-resource-operation-src" data-path="${row}">${row}</td>${btnGroup}</tr>`).join("")
        const nonExistInFolder = Array.from(this.nonExistInFolder, (row, idx) => `<tr><td>${idx + 1}</td><td>${row}</td></tr>`).join("")
        this.entities.wrap.innerHTML = `
            <table class="table">
                 <caption>存在于文件夹但不存在于md文件的资源(共${this.nonExistInFile.size}项)</caption>
                 <thead><tr><th>#</th><th>resource</th><th style="min-width: 130px">operation</th></tr></thead>
                 <tbody>${nonExistInFile || '<tr><td colspan="3" style="text-align: center;">Empty</td></tr>'}</tbody>
            </table>
            <table class="table">
                 <caption>存在于md文件但不存在于文件夹的资源(共${this.nonExistInFolder.size}项)</caption>
                 <thead><tr><th>#</th><th>resource</th></tr></thead>
                 <tbody>${nonExistInFolder || '<tr><td colspan="2" style="text-align: center;">Empty</td></tr>'}</tbody>
            </table>
            <div class="plugin-resource-operation-message">配置</div>
            <textarea rows="10" readonly>${JSON.stringify(output, replacer, "\t")}</textarea>
        `
    }

    close = () => {
        this.nonExistInFile = null;
        this.nonExistInFolder = null;
        this.entities.wrap.innerHTML = "";
        this.utils.hide(this.entities.modal);
        this.togglePreview(false);
    }

    togglePreview = force => {
        const icon = this.entities.iconGroup.querySelector('[action="togglePreview"]');
        const wantClose = force === false || icon.classList.contains("ion-eye");
        const func = wantClose ? "off" : "on";
        const className = ".plugin-resource-operation-src";
        this.entities.$wrap
            [func]("mouseover", className, this._showPopup)
            [func]("mouseout", className, this._hidePopup)
            [func]("mousemove", className, this._showPopup);
        icon.classList.toggle("ion-eye-disabled", wantClose);
        icon.classList.toggle("ion-eye", !wantClose);
    }
    _hidePopup = ev => this.utils.hide(this.entities.popup)
    _showPopup = ev => {
        const popup = this.entities.popup;
        if (!popup) return;

        popup.src = ev.target.dataset.path;
        const left = Math.min(window.innerWidth - 10 - popup.offsetWidth, ev.clientX + 10);
        const top = Math.min(window.innerHeight - 50 - popup.offsetHeight, ev.clientY + 20);
        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;

        this.utils.show(popup);
    }

    getOutput = () => ({
        search_folder: this.utils.getMountFolder(),
        resource_suffix: Array.from(this.resourceSuffixs),
        markdown_suffix: Array.from(this.fileSuffixs),
        ignore_img_html_element: this.config.ignore_img_html_element,
        collect_file_without_suffix: this.config.collect_file_without_suffix,
        ignore_folders: this.config.ignore_folders,
        resource_non_exist_in_file: Array.from(this.nonExistInFile),
        resource_non_exist_in_folder: Array.from(this.nonExistInFolder),
    })

    download = () => {
        const { getCurrentDirPath, openFile, Package: { Path: { join }, Fs: { writeFileSync } } } = this.utils;
        const output = this.getOutput();
        const json = JSON.stringify(output, null, "\t");
        const fileContent = `
## 存在于文件夹，但是不存在于 md 文件的资源(共${output.resource_non_exist_in_file.length}项)

\`\`\`plain
${output.resource_non_exist_in_file.join("\n")}
\`\`\`

## 存在于 md 文件，但是不存在于文件夹的资源(共${output.resource_non_exist_in_folder.length}项)

\`\`\`plain
${output.resource_non_exist_in_folder.join("\n")}
\`\`\`

## JSON

以下为插件相关配置及输出，以供开发者使用

- \`search_folder\`：递归搜索的根目录
- \`resource_suffix\`：判定为 resource 的文件后缀
- \`markdown_suffix\`：判定为 markdown 的文件后缀
- \`ignore_img_html_element\`：是否忽略 html 格式的 img 标签
- \`ignore_folders\`：忽略的目录
- \`resource_non_exist_in_file\`：存在于文件夹，但是不存在于 md 文件的资源
- \`resource_non_exist_in_folder\`：存在于 md 文件，但是不存在于文件夹的资源

\`\`\`json
${json}
\`\`\`

## footer

Designed with ♥ by [obgnail](https://github.com/obgnail/typora_plugin)

`;
        let dir = getCurrentDirPath();
        if (dir === ".") {
            dir = this.utils.getMountFolder();
        }
        const filepath = join(dir, "resource-report.md");
        writeFileSync(filepath, fileContent, "utf8");
        this.config.auto_open && setTimeout(openFile(filepath), 500);
    }

    collectImage = async () => {
        await this.traverseDir(this.utils.getMountFolder(), this.collect);
        this.nonExistInFile = new Set([...this.resources].filter(x => !this.resourcesInFile.has(x)));
        this.nonExistInFolder = new Set([...this.resourcesInFile].filter(x => !this.resources.has(x)));
        this.resources.clear();
        this.resourcesInFile.clear();
    }

    collect = async (filePath, dir) => {
        const { existPath, isNetworkImage, isSpecialImage, Package: { Path, Fs } } = this.utils;
        const { promises: { readFile } } = Fs;
        const { resolve, extname } = Path;

        const getRealPath = async imagePath => {
            let idx = imagePath.lastIndexOf(")");
            while (idx !== -1) {
                const exist = await existPath(imagePath);
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
                if (!src || isNetworkImage(src) || isSpecialImage(src)) continue;

                try {
                    src = decodeURIComponent(src).split("?")[0];
                } catch (e) {
                    console.warn("error path:", src);
                    continue
                }

                src = resolve(dir, src);
                if (this.resourcesInFile.has(src)) continue;

                const resourcePath = await getRealPath(src);
                if (this.resourceSuffixs.has(extname(resourcePath))) {
                    this.resourcesInFile.add(resourcePath);
                }
                const remain = src.slice(resourcePath.length);
                if (remain) {
                    await collectMatch(remain + ")");
                }
            }
        }

        const ext = extname(filePath).toLowerCase();
        if (this.resourceSuffixs.has(ext)) {
            this.resources.add(filePath);
        } else if (this.fileSuffixs.has(ext)) {
            const buffer = await readFile(filePath);
            await collectMatch(buffer.toString());
        }
    }

    traverseDir = async (dir, callback) => {
        const { ignore_folders } = this.config;
        const { Fs: { promises: { readdir, stat } }, Path: { join } } = this.utils.Package;

        async function traverse(dir) {
            const files = await readdir(dir);
            for (const file of files) {
                const filePath = join(dir, file);
                const stats = await stat(filePath);
                if (stats.isFile()) {
                    await callback(filePath, dir);
                } else if (stats.isDirectory() && !ignore_folders.includes(file)) {
                    await traverse(filePath);
                }
            }
        }

        await traverse(dir);
    }
}

module.exports = {
    plugin: resourceOperationPlugin,
};