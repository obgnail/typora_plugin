class fileCounterPlugin extends BasePlugin {
    beforeProcess = () => {
        this.loopDetectInterval = 300;
        this.className = "plugin-file-counter";
    }

    styleTemplate = () => true

    process = () => {
        // typora有bug，有一定概率无法完整加载，强制刷一下
        setTimeout(() => File.editor.library.refreshPanelCommand(), 1200);

        this.utils.loopDetector(this.setAllDirCount, null, this.loopDetectInterval);

        if (this.config.CTRL_WHEEL_TO_SCROLL_SIDEBAR_MENU) {
            document.querySelector("#file-library").addEventListener("wheel", ev => {
                const target = ev.target.closest("#file-library");
                if (target && this.utils.metaKeyPressed(ev)) {
                    target.scrollLeft += ev.deltaY * 0.2;
                    ev.stopPropagation();
                    ev.preventDefault();
                }
            }, true)
        }

        new MutationObserver(mutationList => {
            if (mutationList.length === 1) {
                const add = mutationList[0].addedNodes[0];
                if (add && add.classList && add.classList.contains("file-library-node")) {
                    this.setDirCount(add);
                    return
                }
            }
            const need = mutationList.some(mutation => {
                const {target} = mutation;
                const add = mutation.addedNodes[0];
                return !(target && target.classList && target.classList.contains(this.className) || add && add.classList.contains(this.className))
            })
            need && this.setAllDirCount();
        }).observe(document.getElementById("file-library-tree"), {subtree: true, childList: true});
    }

    verifyExt = filename => {
        if (filename[0] === ".") {
            return false
        }
        const ext = this.utils.Package.Path.extname(filename).replace(/^\./, '');
        if (~this.config.ALLOW_EXT.indexOf(ext.toLowerCase())) {
            return true
        }
    }

    verifySize = stat => 0 > this.config.MAX_SIZE || stat.size < this.config.MAX_SIZE;
    allowRead = (filepath, stat) => this.verifySize(stat) && this.verifyExt(filepath);

    countFiles = (dir, filter, then) => {
        const {Fs: {promises}, Path} = this.utils.Package;
        let fileCount = 0;

        async function traverse(dir) {
            const files = await promises.readdir(dir);
            for (const file of files) {
                const filePath = Path.join(dir, file);
                const stats = await promises.stat(filePath);
                if (stats.isFile() && filter(filePath, stats)) {
                    fileCount++;
                }
                if (stats.isDirectory()) {
                    await traverse(filePath);
                }
            }
        }

        traverse(dir).then(() => then(fileCount)).catch(err => console.error(err));
    }

    setDirCount = treeNode => {
        const dir = treeNode.getAttribute("data-path");
        this.countFiles(dir, this.allowRead, fileCount => {
            let countDiv = treeNode.querySelector(`:scope > .${this.className}`);
            if (fileCount <= this.config.IGNORE_MIN_NUM) {
                this.utils.removeElement(countDiv);
                return
            }
            if (!countDiv) {
                countDiv = document.createElement("div");
                countDiv.classList.add(this.className);
                const background = treeNode.querySelector(".file-node-background");
                treeNode.insertBefore(countDiv, background.nextElementSibling);
            }
            countDiv.innerText = fileCount + "";
        })

        const fileNode = treeNode.querySelector(":scope > .file-node-children");
        if (fileNode) {
            fileNode.querySelectorAll(`:scope > [data-has-sub="true"]`).forEach(this.setDirCount);
        }
    }

    setAllDirCount = () => {
        const root = document.querySelector("#file-library-tree > .file-library-node");
        if (!root) return false;

        console.debug("setAllDirCount");
        this.setDirCount(root);
        return true
    }
}


module.exports = {
    plugin: fileCounterPlugin
};