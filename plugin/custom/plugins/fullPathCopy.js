class fullPathCopy extends BaseCustomPlugin {
    selector = () => "#write h1, h2, h3, h4, h5, h6"
    hint = () => "将当前标题的路径复制到剪切板"
    init = () => {}
    style = () => {}
    html = () => {}
    hotkey = () => ["ctrl+shift+y"]

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

        const filePath = File.getFileName();
        const result = [filePath];
        let headerIdx = 0;
        for (const p of pList) {
            while (headerIdx < 6 && p.ele.tagName !== paragraphList[headerIdx]) {
                result.push("无 " + nameList[headerIdx]);
                headerIdx++;
            }

            if (p.ele.tagName === paragraphList[headerIdx]) {
                result.push(p.ele.querySelector("span").textContent + " " + nameList[headerIdx]);
                headerIdx++;
            }
        }

        const text = this.utils.Package.Path.join(...result);
        navigator.clipboard.writeText(text);
    }
}

module.exports = {
    plugin: fullPathCopy,
};