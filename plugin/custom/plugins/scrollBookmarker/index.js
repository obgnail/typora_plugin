class ScrollBookmarkerPlugin extends BaseCustomPlugin {
    styleTemplate = () => true

    html = () => `
        <fast-window id="plugin-scroll-bookmarker" window-title="${this.pluginName}" window-buttons="close|fa-times" hidden>
            <div class="plugin-scroll-bookmarker-list"></div>
        </fast-window>
    `

    hotkey = () => [this.config.hotkey]

    init = () => {
        this.recordName = this.fixedName
        this.recordSelector = "#write [cid]"
        this.className = "plu-bookmark"
        this.locateUtils = {
            file: "",
            idx: -1,
            time: Date.now(),
            scroll: (idx) => {
                const ele = [...document.querySelectorAll(this.recordSelector)][idx]
                if (ele) this.utils.scroll(ele, 20, true)
            }
        }
        this.entities = {
            write: this.utils.entities.eWrite,
            window: document.querySelector("#plugin-scroll-bookmarker"),
            list: document.querySelector(".plugin-scroll-bookmarker-list"),
        }
    }

    process = () => {
        const stateGetter = ele => ele.classList.contains(this.className)
        const stateRestorer = ele => ele.classList.add(this.className)
        const finalFunc = () => {
            if (this.locateUtils.file && this.locateUtils.idx !== -1) {
                this.locateUtils.scroll(this.locateUtils.idx)
                this.locateUtils.file = ""
                this.locateUtils.idx = -1
            }
        }
        this.utils.stateRecorder.register(this.recordName, this.recordSelector, stateGetter, stateRestorer, finalFunc)

        const modifierKeyPressed = this.utils.modifierKey(this.config.modifier_key)
        this.entities.write.addEventListener("click", ev => {
            if (!modifierKeyPressed(ev)) return
            const paragraph = ev.target.closest(this.recordSelector)
            if (!paragraph) return
            paragraph.classList.add(this.className)
            if (this.config.auto_popup_modal) {
                this.entities.window.show()
            }
            this.refresh()
        })

        this.entities.list.addEventListener("click", ev => {
            const item = ev.target.closest(".bookmark-item")
            if (!item) return
            const { file: targetFilepath, idx } = item.querySelector(".bookmark-item-content").dataset
            const curFilepath = this.utils.getFilePath()
            const isDelete = ev.target.closest(".bookmark-btn")
            if (isDelete) {
                if (curFilepath === targetFilepath) {
                    const ele = [...document.querySelectorAll(this.recordSelector)][idx]
                    if (ele) ele.classList.remove(this.className)
                } else {
                    this.utils.stateRecorder.deleteState(this.recordName, targetFilepath, parseInt(idx))
                }
                this.refresh()
            } else {
                if (targetFilepath && curFilepath !== targetFilepath) {
                    Object.assign(this.locateUtils, { file: targetFilepath, idx, time: Date.now() })
                    this.utils.openFile(targetFilepath)
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
                const map = this.utils.stateRecorder.getState(this.recordName, this.utils.getFilePath())
                if (map && map.size) {
                    this.refresh()
                }
            }
        })
    }

    callback = anchorNode => {
        this.entities.window.toggle()
        this.refresh()
    }

    refresh = () => {
        this.utils.stateRecorder.collect(this.recordName)
        if (!this.entities.window.hidden) {
            this._updateModal()
        }
    }

    _updateModal = () => {
        let item = this.entities.list.firstElementChild
        const map = this.utils.stateRecorder.getState(this.recordName)
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
