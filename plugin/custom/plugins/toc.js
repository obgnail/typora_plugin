class tocPlugin extends BaseCustomPlugin {
    styleTemplate = () => true
    htmlTemplate = () => [{
        id: "plugin-toc",
        class_: "plugin-common-modal plugin-toc",
        style: {display: "none"},
        children: [{class_: "grip-right"}, {class_: "toc-ul"}]
    }]
    hotkey = () => [this.config.hotkey]

    process = () => {
        this.entities = {
            content: document.querySelector("content"),
            modal: document.querySelector("#plugin-toc"),
            grip: document.querySelector("#plugin-toc .grip-right"),
            ul: document.querySelector("#plugin-toc .toc-ul"),
        };

        this.onResize();
        this.utils.addEventListener(this.utils.eventType.outlineUpdated, () => this.entities.modal.style.display !== "none" && this.renewModal());
        this.entities.modal.addEventListener("click", ev => {
            const target = ev.target.closest(".toc-node");
            if (!target) return;
            ev.stopPropagation();
            ev.preventDefault();
            const cid = target.getAttribute("cid");
            this.utils.scrollByCid(cid);
        })
    }

    callback = () => this.toggle(this.entities.modal.style.display !== "none")

    toggle = (show = false) => {
        const write = document.querySelector("#write");
        if (show) {
            write.style.width = "";
            this.entities.modal.style.display = "none";
            this.entities.content.style.removeProperty("right");
            this.entities.content.style.removeProperty("width");
            return
        }

        this.entities.modal.style.removeProperty("display");
        const {width, right} = this.entities.content.getBoundingClientRect();
        const modalWidth = width * this.config.width_percent_when_pin_right / 100;
        this.entities.modal.style.width = modalWidth + "px";
        Object.assign(this.entities.content.style, {
            right: `${right - modalWidth}px`,
            width: `${width - modalWidth}px`,
        });
        write.style.width = "initial";
        this.renewModal();
    }

    renewModal = () => {
        const ul = this._getTocTemplate();
        const toc = this.utils.createElement(ul);
        this.entities.ul.firstElementChild && this.entities.ul.removeChild(this.entities.ul.firstElementChild);
        this.entities.ul.appendChild(toc);
    }

    onResize = () => {
        let contentStartRight = 0;
        let contentStartWidth = 0;
        let modalStartLeft = 0;
        let contentMaxRight = 0;
        const onMouseDown = () => {
            const contentRect = this.entities.content.getBoundingClientRect();
            contentStartRight = contentRect.right;
            contentStartWidth = contentRect.width;

            const modalRect = this.entities.modal.getBoundingClientRect();
            modalStartLeft = modalRect.left;
            contentMaxRight = modalRect.right - 100;
        }
        const onMouseMove = (deltaX, deltaY) => {
            deltaX = -deltaX;
            deltaY = -deltaY;
            let newContentRight = contentStartRight - deltaX;
            if (newContentRight > contentMaxRight) {
                newContentRight = contentMaxRight;
                deltaX = contentStartRight - contentMaxRight;
            }
            this.entities.content.style.right = newContentRight + "px";
            this.entities.content.style.width = contentStartWidth - deltaX + "px";
            this.entities.modal.style.left = modalStartLeft - deltaX + "px";
            return {deltaX, deltaY}
        }
        this.utils.resizeFixedModal(this.entities.grip, this.entities.modal, true, false, onMouseDown, onMouseMove);
    }

    _getTocTemplate = () => {
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