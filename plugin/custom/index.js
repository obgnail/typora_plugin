class CustomPlugin extends global._basePlugin {
    process = () => {
        this.dynamicUtil = {target: null};
        this.callback = new callback();
        this.optionMap = {}
        this.config.OPTIONS.forEach(option => {
            if ((option.name) && this.callback[option.callback] instanceof Function) {
                this.optionMap[option.name] = option;
            }
        })
    }

    dynamicCallArgsGenerator = anchorNode => {
        this.dynamicUtil.target = anchorNode;

        const dynamicCallArgs = [];
        for (const name in this.optionMap) {
            const option = this.optionMap[name];

            if (!option.selector || anchorNode.closest(option.selector)) {
                dynamicCallArgs.push({
                    arg_name: option.name,
                    arg_value: option.name,
                })
            }
        }
        return dynamicCallArgs;
    }

    call = arg_name => {
        const option = this.optionMap[arg_name];
        if (option) {
            const target = this.dynamicUtil.target.closest(option.selector);
            this.callback[option.callback](target, this.utils);
        }
    }
}

class callback {
    fullPathCopy = (anchorNode, utils) => {
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

        const text = utils.Package.Path.join(...result);
        navigator.clipboard.writeText(text);
    }
}

module.exports = {
    plugin: CustomPlugin
};