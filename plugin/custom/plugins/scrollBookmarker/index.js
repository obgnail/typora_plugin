class scrollBookmarkerPlugin extends BaseCustomPlugin {
    styleTemplate = () => true

    htmlTemplate = () => [{id: "plugin-scroll-bookmarker", class_: "plugin-common-modal", style: {display: "none"}}]

    hotkey = () => [this.config.hotkey]

    init = () => {
        this.recordName = "recordScrollBookmark";
        this.recordSelector = "#write [cid]";
        this.className = "plu-bookmark";
        this.locateUtils = {file: "", idx: -1, time: new Date().getTime()};
    }

    beforeProcess = async () => {
        if (this.config.persistence) {
            this.saveFile = this.utils.joinPath("./plugin/custom/plugins/scrollBookmarker/bookmark.json");
            this.bookmarks = await this.loadBookmarks() || {};
        }
    }

    afterProcess = () => {
        this.bookmarks = null;
    }

    process = () => {
        this.entities = {
            modal: document.querySelector("#plugin-scroll-bookmarker")
        }

        if (this.config.allow_drag) {
            this.utils.dragFixedModal(this.entities.modal, this.entities.modal);
        }

        const stateGetter = ele => ele.classList.contains(this.className);
        const stateRestorer = ele => ele.classList.add(this.className);
        const finalFunc = () => {
            const {file, idx} = this.locateUtils;
            if (file && idx !== -1) {
                this._locate(idx);
                this.locateUtils.file = "";
                this.locateUtils.idx = -1;
            }
        }
        this.utils.registerStateRecorder(this.recordName, this.recordSelector, stateGetter, stateRestorer, finalFunc);

        if (this.config.persistence) {
            this.initState();
            this.utils.addEventListener(this.utils.eventType.beforeUnload, () => this.saveBookmarks());
        }

        const altKeyPressed = this.utils.modifierKey("alt");
        document.querySelector("#write").addEventListener("click", ev => {
            if (!altKeyPressed(ev)) return;
            const paragraph = ev.target.closest(this.recordSelector);
            if (!paragraph) return;
            ev.stopPropagation();
            ev.preventDefault();
            paragraph.classList.add(this.className);
            if (this.config.auto_popup_modal) {
                this.entities.modal.style.display = "";
            }
            this.refresh();
        })

        this.entities.modal.addEventListener("click", ev => {
            if (this.utils.metaKeyPressed(ev)) return;
            const item = ev.target.closest(".bookmark-item");
            if (!item) return;
            ev.stopPropagation();
            ev.preventDefault();
            const content = item.querySelector(".bookmark-item-content");
            const file = content.getAttribute("file");
            const idx = content.getAttribute("idx");
            const btn = ev.target.closest(".bookmark-btn");
            if (btn) {
                this.removeMarker(idx, file);
            } else {
                this.locate(idx, file);
            }
        })

        this.utils.addEventListener(this.utils.eventType.fileEdited, () => {
            if (new Date().getTime() > this.locateUtils.time + 2000) {
                this.refreshIfNeed();
            }
        })
    }

    callback = () => {
        this.entities.modal.style.display = this.entities.modal.style.display === "none" ? "" : "none";
        this.refresh();
    }

    refresh = () => {
        this.utils.collectState(this.recordName);
        if (this.entities.modal.style.display !== "none") {
            this.updateModal();
        }
    }

    refreshIfNeed = () => {
        const map = this.utils.getState(this.recordName, this.utils.getFilePath());
        if (map && map.size) {
            this.refresh();
        }
    }

    updateModal = () => {
        if (this.entities.modal.childElementCount === 0) {
            this.entities.modal.textContent = "";
        }

        let item = this.entities.modal.firstElementChild;
        const map = this.utils.getState(this.recordName);
        for (const [filepath, indexList] of map.entries()) {
            for (const index of indexList.keys()) {
                if (!item) {
                    this.appendMarker(filepath, index);
                    item = this.entities.modal.lastElementChild;
                } else {
                    this.updateMarker(item, filepath, index);
                }
                item = item.nextElementSibling;
            }
        }
        while (item) {
            const next = item.nextElementSibling;
            item.parentElement.removeChild(item);
            item = next
        }

        if (this.entities.modal.childElementCount === 0) {
            this.entities.modal.textContent = "请尝试 alt+click 正文内容";
        }
    }

    updateMarker = (ele, filepath, idx) => {
        const _filepath = this.utils.getFileName(filepath);
        const content = ele.querySelector(".bookmark-item-content");
        if (!content) return;
        content.textContent = `${_filepath} - ${idx}`;
        content.setAttribute("file", filepath);
        content.setAttribute("idx", idx);
    }

    appendMarker = (filepath, idx) => {
        const _filepath = this.utils.getFileName(filepath);
        const children = [
            {class_: "bookmark-item-content", text: `${_filepath} - ${idx}`, file: filepath, idx},
            {class_: "bookmark-btn fa fa-trash-o"}
        ]
        const marker = [{class_: "bookmark-item", children}];
        this.utils.appendElements(this.entities.modal, marker);
    }

    removeMarker = (idx, filepath) => {
        const filepath_ = this.utils.getFilePath();
        if (filepath_ === filepath) {
            const ele = Array.from(document.querySelectorAll(this.recordSelector))[idx];
            ele && ele.classList.remove(this.className);
        } else {
            this.utils.deleteState(this.recordName, filepath, parseInt(idx));
        }
        this.refresh();
    }

    locate = (idx, filepath) => {
        const filepath_ = this.utils.getFilePath();
        if (filepath && filepath_ !== filepath) {
            this.locateUtils.file = filepath;
            this.locateUtils.idx = idx;
            this.locateUtils.time = new Date().getTime();
            this.utils.openFile(filepath);
        } else {
            this._locate(idx);
        }
    }

    _locate = idx => {
        const ele = Array.from(document.querySelectorAll(this.recordSelector))[idx];
        ele && this.utils.scroll(ele, 20, true);
    }

    loadBookmarks = async filepath => {
        filepath = filepath || this.saveFile;
        await this.utils.Package.FsExtra.ensureFile(filepath);
        try {
            return await this.utils.Package.FsExtra.readJson(filepath);
        } catch (err) {
            console.error(err);
        }
    }

    saveBookmarks = filepath => {
        filepath = filepath || this.saveFile;
        const obj = {};
        const map = this.utils.getState(this.recordName);
        for (const [filepath, indexList] of map.entries()) {
            obj[filepath] = Array.from(indexList.keys());
        }
        this.utils.Package.FsExtra.writeJsonSync(filepath, obj);
    }

    initState = () => {
        const map = new Map();
        for (const [filepath, idxList] of Object.entries(this.bookmarks)) {
            map.set(filepath, new Map(idxList.map(ele => [ele, true])));
        }
        map.size && this.utils.setState(this.recordName, map);
    }
}

module.exports = {
    plugin: scrollBookmarkerPlugin,
};