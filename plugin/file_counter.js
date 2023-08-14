(() => {
    const config = global._pluginUtils.getPluginSetting("file_counter");
    const Package = global._pluginUtils.Package;

    (() => {
        const css = `
        .${config.CLASS_NAME} {
            display: inline-block;
            float: right;
            white-space: nowrap;
            overflow-x: visible;
            overflow-y: hidden;
            margin-right: 10px;
            padding-left: 3px;
            padding-right: 3px;
            border-radius: 3px;
            background: var(--active-file-bg-color);
            color: var(--active-file-text-color);
            opacity: 1;
        }
        `
        global._pluginUtils.insertStyle("plugin-file-counter-style", css);
    })()

    const verifyExt = filename => {
        if (filename[0] === ".") {
            return false
        }
        const ext = Package.Path.extname(filename).replace(/^\./, '');
        if (~config.ALLOW_EXT.indexOf(ext.toLowerCase())) {
            return true
        }
    }
    const verifySize = (stat) => 0 > config.MAX_SIZE || stat.size < config.MAX_SIZE;
    const allowRead = (filepath, stat) => verifySize(stat) && verifyExt(filepath);

    const countFiles = (dir, filter, then) => {
        let fileCount = 0;

        async function traverse(dir) {
            const files = await Package.Fs.promises.readdir(dir);
            for (const file of files) {
                const filePath = Package.Path.join(dir, file);
                const stats = await Package.Fs.promises.stat(filePath);
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

    const getChild = (ele, className) => {
        for (const child of ele.children) {
            if (child.classList.contains(className)) {
                return child
            }
        }
        return false
    }

    const setDirCount = treeNode => {
        const dir = treeNode.getAttribute("data-path");
        countFiles(dir, allowRead, fileCount => {
            let countDiv = getChild(treeNode, config.CLASS_NAME);
            if (!countDiv) {
                countDiv = document.createElement("div");
                countDiv.classList.add(config.CLASS_NAME);
                const background = treeNode.querySelector(".file-node-background");
                treeNode.insertBefore(countDiv, background.nextElementSibling);
            }
            countDiv.innerText = fileCount + "";
        })

        const children = getChild(treeNode, "file-node-children");
        if (children && children.children) {
            children.children.forEach(child => {
                if (child.getAttribute("data-has-sub") === "true") {
                    setDirCount(child);
                }
            })
        }
    }

    const setAllDirCount = () => {
        const root = document.querySelector("#file-library-tree > .file-library-node");
        if (!root) return false;
        console.log("setAllDirCount");
        setDirCount(root);
        return true
    }

    new MutationObserver(mutationList => {
        if (mutationList.length === 1) {
            const add = mutationList[0].addedNodes[0];
            if (add && add.classList && add.classList.contains("file-library-node")) {
                setDirCount(add);
                return
            }
        }

        for (const mutation of mutationList) {
            if (mutation.target && mutation.target.classList && mutation.target.classList.contains(config.CLASS_NAME)
                || mutation.addedNodes[0] && mutation.addedNodes[0].classList && mutation.addedNodes[0].classList.contains(config.CLASS_NAME)) {
                continue
            }
            setAllDirCount();
            return
        }
    }).observe(document.getElementById("file-library-tree"), {subtree: true, childList: true});

    global._pluginUtils.loopDetector(setAllDirCount, null, config.LOOP_DETECT_INTERVAL);

    module.exports = {};

    console.log("file_counter.js had been injected");
})()