class scrollBookmarkerPlugin extends BaseCustomPlugin {
    styleTemplate = () => true

    htmlTemplate = () => [{id: "plugin-scroll-bookmarker", class_: "plugin-common-modal", style: {display: "none"}}]

    init = () => {
        this.recordName = "recordScrollBookmark";
        this.recordSelector = "#write [cid]";
        this.className = "plu-bookmark";
        this.locateUtils = {file: "", idx: -1, time: new Date().getTime()};
    }

    process = () => {
        this.entities = {
            modal: document.querySelector("#plugin-scroll-bookmarker")
        }

        if (this.config.allow_drag) {
            this.utils.dragFixedModal(this.entities.modal, this.entities.modal);
        }

        if (this.config.use_button) {
            this.utils.registerQuickButton("bookmarker", [2, 1], "书签管理器", "fa fa-bookmark", {fontSize: "17px"}, this.callback);
        }

        this.utils.registerStateRecorder(
            this.recordName,
            this.recordSelector,
            ele => ele.classList.contains(this.className),
            ele => ele.classList.add(this.className),
            () => {
                const {file, idx} = this.locateUtils;
                if (file && idx !== -1) {
                    this._locate(idx);
                    this.locateUtils.file = "";
                    this.locateUtils.idx = -1;
                }
            }
        )

        document.querySelector("#write").addEventListener("click", ev => {
            if (!this.utils.altKeyPressed(ev)) return;
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
            const btn = ev.target.closest(".bookmark-del-btn");
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
            item.parentElement.removeChild(item);
            item = item.nextElementSibling;
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
        const marker = [{
            class_: "bookmark-item", children: [
                {class_: "bookmark-item-content", text: `${_filepath} - ${idx}`, file: filepath, idx},
                {class_: "bookmark-del-btn fa fa-trash-o"}
            ]
        }]
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
}

module.exports = {
    plugin: scrollBookmarkerPlugin,
};