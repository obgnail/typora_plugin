class scrollBookmarkerPlugin extends BaseCustomPlugin {
    styleTemplate = () => true

    html = () => `
        <div id="plugin-scroll-bookmarker" class="plugin-common-modal plugin-common-hidden">
            <div class="plugin-scroll-bookmarker-icon-group">
                <div class="plugin-scroll-bookmarker-icon ion-close" action="close" ty-hint="${this.i18n.t('func.close')}"></div>
                <div class="plugin-scroll-bookmarker-icon ion-arrow-move" action="move" ty-hint="${this.i18n.t('func.move')}"></div>
            </div>
            <div class="plugin-scroll-bookmarker-list"></div>
        </div>
    `

    hotkey = () => [this.config.hotkey]

    init = () => {
        this.recordName = "recordScrollBookmark";
        this.recordSelector = "#write [cid]";
        this.className = "plu-bookmark";
        this.locateUtils = { file: "", idx: -1, time: new Date().getTime() };
        this.entities = {
            modal: document.querySelector("#plugin-scroll-bookmarker"),
            iconGroup: document.querySelector("#plugin-scroll-bookmarker .plugin-scroll-bookmarker-icon-group"),
            moveIcon: document.querySelector('#plugin-scroll-bookmarker .plugin-scroll-bookmarker-icon[action="move"]'),
            list: document.querySelector("#plugin-scroll-bookmarker .plugin-scroll-bookmarker-list"),
        }
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

        if (this.config.persistence) {
            this.initState();
            this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.beforeUnload, () => this.saveBookmarks());
        }

        this.utils.dragFixedModal(this.entities.moveIcon, this.entities.modal, false);

        const modifierKeyPressed = this.utils.modifierKey(this.config.modifier_key)
        this.utils.entities.eWrite.addEventListener("click", ev => {
            if (!modifierKeyPressed(ev)) return;
            const paragraph = ev.target.closest(this.recordSelector);
            if (!paragraph) return;
            paragraph.classList.add(this.className);
            if (this.config.auto_popup_modal) {
                this.utils.show(this.entities.modal);
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

        this.entities.iconGroup.addEventListener("click", ev => {
            const target = ev.target.closest("[action]");
            if (!target) return;
            const action = target.getAttribute("action");
            if (action === "close") {
                this.utils.toggleVisible(this.entities.modal);
            }
        })

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileEdited, () => {
            if (new Date().getTime() > this.locateUtils.time + 2000) {
                this.refreshIfNeed();
            }
        })
    }

    callback = anchorNode => {
        this.utils.toggleVisible(this.entities.modal);
        this.refresh();
    }

    refresh = () => {
        this.utils.stateRecorder.collect(this.recordName);
        if (this.utils.isShow(this.entities.modal)) {
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
            this.entities.list.textContent = this.i18n.t("tryAltClick")
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
            ele && ele.classList.remove(this.className);
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
        const map = this.utils.stateRecorder.getState(this.recordName);
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
        map.size && this.utils.stateRecorder.setState(this.recordName, map);
    }
}

module.exports = {
    plugin: scrollBookmarkerPlugin,
}
