class ScrollBookmarkerPlugin extends BaseCustomPlugin {
    styleTemplate = () => true

    html = () => `
        <fast-window id="plugin-scroll-bookmarker" window-title="${this.pluginName}" window-buttons="close|fa-times" hidden>
            <div class="plugin-scroll-bookmarker-list"></div>
        </fast-window>`

    hotkey = () => [this.config.hotkey]

    init = () => {
        this.recordSelector = "#write [cid]"
        this.className = "plu-bookmark"
        this.locateUtils = {
            file: "",
            idx: -1,
            time: Date.now(),
            getEl: (idx) => [...document.querySelectorAll(this.recordSelector)][idx],
            scroll: (idx) => {
                const el = this.locateUtils.getEl(idx)
                if (el) this.utils.scroll(el, 20, true)
            }
        }
        this.recorder = {
            register: () => {
                this.utils.stateRecorder.register({
                    name: this.fixedName,
                    selector: this.recordSelector,
                    stateGetter: el => el.classList.contains(this.className),
                    stateRestorer: el => el.classList.add(this.className),
                    finalFn: () => {
                        if (this.locateUtils.file && this.locateUtils.idx !== -1) {
                            this.locateUtils.scroll(this.locateUtils.idx)
                            this.locateUtils.file = ""
                            this.locateUtils.idx = -1
                        }
                    }
                })
            },
            collect: () => this.utils.stateRecorder.collect(this.fixedName),
            getState: () => this.utils.stateRecorder.getState(this.fixedName),
        }
        this.entities = {
            write: this.utils.entities.eWrite,
            window: document.querySelector("#plugin-scroll-bookmarker"),
            list: document.querySelector(".plugin-scroll-bookmarker-list"),
        }
    }

    process = () => {
        this.recorder.register()

        const isModifierKeyPressed = this.utils.modifierKey(this.config.modifier_key)
        this.entities.write.addEventListener("click", ev => {
            if (!isModifierKeyPressed(ev)) return
            const node = ev.target.closest(this.recordSelector)
            if (!node) return
            node.classList.add(this.className)
            if (this.config.auto_popup_modal) {
                this.entities.window.show()
            }
            this.refresh()
        })

        this.entities.list.addEventListener("click", ev => {
            const item = ev.target.closest(".bookmark-item")
            if (!item) return
            const curFile = this.utils.getFilePath()
            const { file: targetFile, idx } = item.querySelector(".bookmark-item-content").dataset
            const isDelete = ev.target.closest(".bookmark-btn")
            if (isDelete) {
                if (curFile === targetFile) {
                    this.locateUtils.getEl(idx)?.classList.remove(this.className)
                } else {
                    this.recorder.getState()?.get(targetFile)?.delete(parseInt(idx))
                }
                this.refresh()
            } else {
                if (targetFile && curFile !== targetFile) {
                    Object.assign(this.locateUtils, { file: targetFile, idx, time: Date.now() })
                    this.utils.openFile(targetFile)
                } else {
                    this.locateUtils.scroll(idx)
                }
            }
        })

        this.entities.window.addEventListener("btn-click", ev => {
            if (ev.detail.action === "close") {
                this.entities.window.hide()
            }
        })

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileEdited, () => {
            if (Date.now() > this.locateUtils.time + 2000) {
                const needRefresh = !!this.recorder.getState()?.get(this.utils.getFilePath())?.size
                if (needRefresh) this.refresh()
            }
        })
    }

    callback = anchorNode => {
        this.entities.window.toggle()
        this.refresh()
    }

    refresh = () => {
        this.recorder.collect()
        if (!this.entities.window.hidden) {
            this._updateModal()
        }
    }

    _updateModal = () => {
        let item = this.entities.list.firstElementChild
        const map = this.recorder.getState()
        for (const [filepath, idxList] of map.entries()) {
            for (const idx of idxList.keys()) {
                const fileName = this.utils.getFileName(filepath)
                if (item) {
                    const content = item.querySelector(".bookmark-item-content")
                    if (content) {
                        content.textContent = `${fileName} - ${idx}`
                        content.dataset.file = filepath
                        content.dataset.idx = idx
                    }
                } else {
                    this.entities.list.insertAdjacentHTML("beforeend", `
                        <div class="bookmark-item">
                            <div class="bookmark-item-content" data-file="${filepath}" data-idx="${idx}">${fileName} - ${idx}</div>
                            <div class="bookmark-btn fa fa-trash-o"></div>
                        </div>`)
                    item = this.entities.list.lastElementChild
                }
                item = item.nextElementSibling
            }
        }
        while (item) {
            const next = item.nextElementSibling
            item.parentElement.removeChild(item)
            item = next
        }
    }
}

module.exports = {
    plugin: ScrollBookmarkerPlugin
}
