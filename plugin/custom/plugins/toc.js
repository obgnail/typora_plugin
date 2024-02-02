class tocPlugin extends BaseCustomPlugin {
    styleTemplate = () => true
    htmlTemplate = () => [{id: "plugin-toc", class_: "plugin-common-modal plugin-toc", style: {display: "none"}}]
    hotkey = () => [this.config.hotkey]

    process = () => {
        this.toc = document.querySelector("#plugin-toc");
        this.utils.addEventListener(this.utils.eventType.outlineUpdated, () => this.toc.style.display === "block" && this.renewModal());
        this.toc.addEventListener("click", ev => {
            const target = ev.target.closest(".toc-node");
            if (!target) return;
            ev.stopPropagation();
            ev.preventDefault();
            const cid = target.getAttribute("cid");
            this.utils.scrollByCid(cid);
        })
    }

    callback = () => this.toggle(this.toc.style.display === "none")

    toggle = (show = false) => {
        const content = document.querySelector("content");
        if (!show) {
            this.toc.style.display = "none";
            content.style.removeProperty("right");
            content.style.removeProperty("width");
            return
        }

        const {top, width, height, right} = content.getBoundingClientRect();
        this.toc.style.display = "block";
        this.renewModal();
        const modalWidth = this.toc.getBoundingClientRect().width;
        const tocStyle = {top: `${top}px`, height: `${height}px`};
        const contentStyle = {right: `${right - modalWidth}px`, width: `${width - modalWidth}px`};
        Object.assign(this.toc.style, tocStyle);
        Object.assign(content.style, contentStyle);
    }

    renewModal = () => {
        const ul = this.getTocTemplate();
        const toc = this.utils.createElement(ul);
        this.toc.firstElementChild && this.toc.removeChild(this.toc.firstElementChild);
        this.toc.appendChild(toc);
    }

    getTocTemplate = () => {
        const rootNode = this._getTocRootNode();
        const li = rootNode.children.map(this._tocTemplate);
        return {ele: "ul", children: li}
    }

    _getTocRootNode = () => {
        const root = {depth: 0, cid: "n0", text: "root", children: []};
        const {headers = []} = File.editor.nodeMap.toc;
        if (!headers) return root;

        const toc = headers.map(({attributes: {depth, text}, cid}) => ({depth, text, cid, children: []}));
        toc.forEach((node, idx) => {
            const parent = this._findParent(toc, idx - 1, node.depth) || root;
            parent.children.push(node);
        })
        return root
    }

    _tocTemplate = rootNode => {
        const {text, cid, depth, children = []} = rootNode;
        const content = [{class_: "toc-node", cid, children: [{ele: "span", class_: "toc-text", text}]}];
        const list = children.map(this._tocTemplate);
        if (list.length) {
            content.push({ele: "ul", children: list});
        }
        return {ele: "li", class_: "plugin-toc-depth" + depth, children: content}
    }

    _findParent = (toc, idx, depth) => {
        while (idx >= 0 && toc[idx].depth >= depth) {
            idx--;
        }
        return toc[idx]
    }
}


module.exports = {
    plugin: tocPlugin
};