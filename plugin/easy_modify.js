class easyModifyPlugin extends BasePlugin {
    hotkey = () => [
        { hotkey: this.config.HOTKEY_COPY_FULL_PATH, callback: () => this.call("copy_full_path") },
        { hotkey: this.config.HOTKEY_INCREASE_HEADERS_LEVEL, callback: () => this.call("increase_headers_level") },
        { hotkey: this.config.HOTKEY_DECREASE_HEADERS_LEVEL, callback: () => this.call("decrease_headers_level") },
    ]

    init = () => {
        const arg_hint = "若无选中文段，则调整整篇文档";
        this.callArgs = [
            { arg_name: "复制标题路径", arg_value: "copy_full_path", arg_hotkey: this.config.HOTKEY_COPY_FULL_PATH },
            { arg_name: "提升选中文段的标题等级", arg_value: "increase_headers_level", arg_hotkey: this.config.HOTKEY_INCREASE_HEADERS_LEVEL, arg_hint },
            { arg_name: "降低选中文段的标题等级", arg_value: "decrease_headers_level", arg_hotkey: this.config.HOTKEY_DECREASE_HEADERS_LEVEL, arg_hint },
        ];
    }

    changeHeadersLevel = incr => this._getTargetHeaders().forEach(node => this._changeHeaderLevel(node, incr));

    copyFullPath = () => {
        const getHeaderName = (title, name) => `${title} ${name}`;
        const paragraphList = ["H1", "H2", "H3", "H4", "H5", "H6"];
        const nameList = ["一级标题", "二级标题", "三级标题", "四级标题", "五级标题", "六级标题"];
        const pList = [];
        let ele = this.utils.getAnchorNode().closest("#write > [cid]")[0];

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

    call = type => {
        const funcMap = {
            increase_headers_level: () => this.changeHeadersLevel(true),
            decrease_headers_level: () => this.changeHeadersLevel(false),
            copy_full_path: () => this.copyFullPath(),
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
