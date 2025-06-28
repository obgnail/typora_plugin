class scrollBookmarkerPlugin extends BaseCustomPlugin {
    styleTemplate = () => true

    html = () => `
        <fast-window id="plugin-scroll-bookmarker" window-title="${this.pluginName}" window-buttons="close|fa-times" hidden>
            <div class="plugin-scroll-bookmarker-list"></div>
        </fast-window>
    `

    hotkey = () => [this.config.hotkey]

    init = () => {
        this.recordName = this.fixedName
        this.recordSelector = "#write [cid]";
        this.className = "plu-bookmark";
        this.locateUtils = { file: "", idx: -1, time: new Date().getTime() };
        this.entities = {
            write: this.utils.entities.eWrite,
            window: document.querySelector("#plugin-scroll-bookmarker"),
            list: document.querySelector(".plugin-scroll-bookmarker-list"),
        }
    }

    process = () => {
        const stateGetter = ele => ele.classList.contains(this.className);
        const stateRestorer = ele => ele.classList.add(this.className);
        const finalFunc = () => {
            const { file, idx } = this.locateUtils;
            if (file && idx !== -1) {
                this._locate(idx);
                this.locateUtils.file = "";
                this.locateUtils.idx = -1;
            }
        }
        this.utils.stateRecorder.register(this.recordName, this.recordSelector, stateGetter, stateRestorer, finalFunc);

        const modifierKeyPressed = this.utils.modifierKey(this.config.modifier_key)
        this.entities.write.addEventListener("click", ev => {
            if (!modifierKeyPressed(ev)) return;
            const paragraph = ev.target.closest(this.recordSelector);
            if (!paragraph) return;
            paragraph.classList.add(this.className);
            if (this.config.auto_popup_modal) {
                this.entities.window.show();
            }
            this.refresh();
        })

        this.entities.list.addEventListener("click", ev => {
            const item = ev.target.closest(".bookmark-item");
            if (!item) return;
            ev.stopPropagation();
            ev.preventDefault();
            const content = item.querySelector(".bookmark-item-content");
            const file = content.dataset.file
            const idx = content.dataset.idx
            const btn = ev.target.closest(".bookmark-btn");
            if (btn) {
                this.removeMarker(idx, file);
            } else {
                this.locate(idx, file);
            }
        })

        this.entities.window.addEventListener("btn-click", ev => {
            const { action } = ev.detail
            if (action === "close") {
                this.entities.window.hide()
            }
        })

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileEdited, () => {
            if (new Date().getTime() > this.locateUtils.time + 2000) {
                this.refreshIfNeed();
            }
        })
    }

    callback = anchorNode => {
        this.entities.window.toggle()
        this.refresh();
    }

    refresh = () => {
        this.utils.stateRecorder.collect(this.recordName);
        if (!this.entities.window.hidden) {
            this.updateModal();
        }
    }

    refreshIfNeed = () => {
        const map = this.utils.stateRecorder.getState(this.recordName, this.utils.getFilePath());
        if (map && map.size) {
            this.refresh();
        }
    }

    updateModal = () => {
        if (this.entities.list.childElementCount === 0) {
            this.entities.list.textContent = "";
        }

        let item = this.entities.list.firstElementChild;
        const map = this.utils.stateRecorder.getState(this.recordName);
        for (const [filepath, indexList] of map.entries()) {
            for (const index of indexList.keys()) {
                if (!item) {
                    this.appendMarker(filepath, index);
                    item = this.entities.list.lastElementChild;
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

        if (this.entities.list.childElementCount === 0) {
            const click = `${this.config.modifier_key}+click`.split("+").filter(Boolean).map(e => e[0].toUpperCase() + e.slice(1).toLowerCase()).join("+")
            this.entities.list.textContent = this.i18n.t("tryClick", { click })
        }
    }

    updateMarker = (ele, filepath, idx) => {
        const _filepath = this.utils.getFileName(filepath);
        const content = ele.querySelector(".bookmark-item-content");
        if (content) {
            content.textContent = `${_filepath} - ${idx}`
            content.dataset.file = filepath
            content.dataset.idx = idx
        }
    }

    appendMarker = (filepath, idx) => {
        const fileName = this.utils.getFileName(filepath)
        const el = `
            <div class="bookmark-item">
                <div class="bookmark-item-content" data-file="${filepath}" data-idx="${idx}">${fileName} - ${idx}</div>
                <div class="bookmark-btn fa fa-trash-o"></div>
            </div>`
        this.entities.list.insertAdjacentHTML("beforeend", el)
    }

    removeMarker = (idx, filepath) => {
        const filepath_ = this.utils.getFilePath();
        if (filepath_ === filepath) {
            const ele = [...document.querySelectorAll(this.recordSelector)][idx]
            if (ele) ele.classList.remove(this.className)
        } else {
            this.utils.stateRecorder.deleteState(this.recordName, filepath, parseInt(idx));
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
        const ele = [...document.querySelectorAll(this.recordSelector)][idx]
        if (ele) this.utils.scroll(ele, 20, true)
    }
}

module.exports = {
    plugin: scrollBookmarkerPlugin,
}
