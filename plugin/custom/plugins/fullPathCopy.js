class fullPathCopy extends BaseCustomPlugin {
    selector = () => "#write > [cid]"
    hint = () => "将当前标题的路径复制到剪切板"
    hotkey = () => [this.config.hotkey]
    callback = anchorNode => {
        const paragraphList = ["H1", "H2", "H3", "H4", "H5", "H6"];
        const nameList = ["一级标题", "二级标题", "三级标题", "四级标题", "五级标题", "六级标题"];
        const pList = [];
        let ele = anchorNode;

        while (ele) {
            const idx = paragraphList.indexOf(ele.tagName);
            if (idx !== -1) {
                if (pList.length === 0 || (pList[pList.length - 1].idx > idx)) {
                    pList.push({ele, idx})
                    if (pList[pList.length - 1].idx === 0) break;
                }
            }
            ele = ele.previousElementSibling;
        }

        pList.reverse();

        const filePath = (this.config.full_file_path) ? this.utils.getFilePath() : File.getFileName();
        const result = [filePath];
        let headerIdx = 0;
        for (const p of pList) {
            while (headerIdx < 6 && p.ele.tagName !== paragraphList[headerIdx]) {
                if (!this.config.ignore_empty_header) {
                    const name = this.getHeaderName("无", nameList[headerIdx]);
                    result.push(name);
                }
                headerIdx++;
            }

            if (p.ele.tagName === paragraphList[headerIdx]) {
                const name = this.getHeaderName(p.ele.querySelector("span").textContent, nameList[headerIdx]);
                result.push(name);
                headerIdx++;
            }
        }

        const text = this.utils.Package.Path.join(...result);
        navigator.clipboard.writeText(text);
    }

    getHeaderName = (title, name) => {
        const space = (this.config.add_space) ? " " : "";
        return title + space + name
    }
}

module.exports = {
    plugin: fullPathCopy,
};