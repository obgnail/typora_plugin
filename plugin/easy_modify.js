class easyModifyPlugin extends BasePlugin {
    init = () => {
        this.callArgs = [
            { arg_name: "提升选中文段的标题等级", arg_value: "increaseHeadersLevel", arg_hint: "若无选中文段，则调整整篇文档" },
            { arg_name: "降低选中文段的标题等级", arg_value: "decreaseHeadersLevel", arg_hint: "若无选中文段，则调整整篇文档" },
        ];
    }

    dynamicCallArgsGenerator = (anchorNode, meta) => {
        meta.target = {
            copyFullPath: anchorNode.closest("#write > [cid]"),
        };
        return [{ arg_name: "复制标题路径", arg_value: "copyFullPath" }]
    }

    changeHeadersLevel = incr => this._getTargetHeaders().forEach(node => this._changeHeaderLevel(node, incr));

    copyFullPath = anchorNode => {
        const getHeaderName = (title, name) => `${title} ${name}`;
        const paragraphList = ["H1", "H2", "H3", "H4", "H5", "H6"];
        const nameList = ["一级标题", "二级标题", "三级标题", "四级标题", "五级标题", "六级标题"];
        const pList = [];
        let ele = anchorNode;

        while (ele) {
            const idx = paragraphList.indexOf(ele.tagName);
            if (idx !== -1) {
                if (pList.length === 0 || (pList[pList.length - 1].idx > idx)) {
                    pList.push({ ele, idx })
                    if (pList[pList.length - 1].idx === 0) break;
                }
            }
            ele = ele.previousElementSibling;
        }

        pList.reverse();

        const filePath = this.utils.getFilePath();
        const result = [filePath || "untitled"];
        let headerIdx = 0;
        for (const p of pList) {
            while (headerIdx < 6 && p.ele.tagName !== paragraphList[headerIdx]) {
                result.push(getHeaderName("无", nameList[headerIdx]));
                headerIdx++;
            }
            if (p.ele.tagName === paragraphList[headerIdx]) {
                result.push(getHeaderName(p.ele.textContent, nameList[headerIdx]));
                headerIdx++;
            }
        }

        const text = this.utils.Package.Path.join(...result);
        navigator.clipboard.writeText(text);
    }

    _getTargetHeaders = () => {
        const headers = File.editor.nodeMap.toc.headers;
        const range = window.getSelection().getRangeAt(0);
        if (range.collapsed) return headers;

        const fragment = range.cloneContents();
        const cidSet = new Set(Array.from(fragment.querySelectorAll(`[mdtype='heading']`), e => e.getAttribute('cid')));
        return headers.filter(h => cidSet.has(h.cid))
    }

    _changeHeaderLevel = (node, incr) => {
        const nodeType = node.get('type');
        if (incr && nodeType === 'paragraph') {
            File.editor.stylize.changeBlock('header6', node);
            return;
        }
        if (nodeType === 'heading') {
            const newLevel = +node.get('depth') + (incr ? -1 : 1);
            if (newLevel === 7) {
                File.editor.stylize.changeBlock('paragraph', node);
            } else if (0 < newLevel && newLevel <= 6) {
                File.editor.stylize.changeBlock(`header${newLevel}`, node);
            }
        }
    }

    call = (type, meta) => {
        const funcMap = {
            increaseHeadersLevel: () => this.changeHeadersLevel(true),
            decreaseHeadersLevel: () => this.changeHeadersLevel(false),
            copyFullPath: () => this.copyFullPath(meta.target.copyFullPath),
        }
        const func = funcMap[type];
        if (func) {
            func();
            this.utils.notification.show("执行成功");
        }
    }
}


module.exports = {
    plugin: easyModifyPlugin,
};
