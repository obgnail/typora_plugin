class ResizeTablePlugin extends BasePlugin {
    styleTemplate = () => this.config.REMOVE_MIN_CELL_WIDTH

    process = () => {
        this.utils.settings.autoSave(this)
        this.toggleRecorder(false)
        this.toggleResizer(true)
    }

    _onMouseDown = ev => {
        if (!this.utils.metaKeyPressed(ev)) return
        const cell = ev.target.closest("th, td")
        if (!cell) return
        const { target, direction } = this._findResizeTarget(cell, ev)
        if (!target) return

        ev.stopPropagation()
        ev.preventDefault()
        this._startResizing(target, direction, ev)
    }

    _startResizing = (target, direction, ev) => {
        const { width: startWidth, height: startHeight } = target.getBoundingClientRect()
        const { clientX: startX, clientY: startY } = ev
        const isHorizontal = direction === "right"

        target.style.width = `${startWidth}px`
        target.style.height = `${startHeight}px`
        target.style.cursor = isHorizontal ? "col-resize" : "row-resize"

        this._cleanSiblingStyles(target, isHorizontal)
        const rafManager = this.utils.getRafManager()

        const onMouseMove = ev => {
            if (!this.utils.metaKeyPressed(ev)) return
            const currentX = ev.clientX
            const currentY = ev.clientY
            rafManager.schedule(() => {
                if (isHorizontal) {
                    target.style.width = `${startWidth + currentX - startX}px`
                } else {
                    target.style.height = `${startHeight + currentY - startY}px`
                }
            })
        }

        const onMouseUp = () => {
            target.style.cursor = ""
            rafManager.cancel()
            document.removeEventListener("mousemove", onMouseMove)
            document.removeEventListener("mouseup", onMouseUp)
        }

        document.addEventListener("mousemove", onMouseMove)
        document.addEventListener("mouseup", onMouseUp)
    }

    _cleanSiblingStyles = (target, isHorizontal) => {
        if (isHorizontal) {
            const rowTag = target.tagName === "TD" ? "tbody" : "thead"
            const nth = this._getNthChildIndex(target)
            const siblingsInColumn = target.closest(rowTag).querySelectorAll(`tr > ${target.tagName}:nth-child(${nth})`)
            this._removeStyle(siblingsInColumn, target, "width")
        } else {
            const siblingsInRow = target.parentElement.children
            this._removeStyle(siblingsInRow, target, "height")
        }
    }

    _removeStyle = (elements, exclude, prop) => {
        for (const el of elements) {
            if (el !== exclude) el.style?.removeProperty(prop)
        }
    }

    _getNthChildIndex = (el) => {
        let index = 1
        while ((el = el.previousElementSibling)) index++
        return index
    }

    _getResizeDirection = (target, { clientX, clientY }) => {
        if (!target) return null
        const { right, bottom } = target.getBoundingClientRect()
        const threshold = this.config.DRAG_THRESHOLD
        if (Math.abs(right - clientX) <= threshold) return "right"
        if (Math.abs(bottom - clientY) <= threshold) return "bottom"
        return null
    }

    _findResizeTarget = (cell, ev) => {
        const nth = this._getNthChildIndex(cell)
        const prevRow = cell.parentElement.previousElementSibling
        const cellAbove = prevRow
            ? prevRow.querySelector(`td:nth-child(${nth})`)
            : cell.closest("table").querySelector(`thead tr > th:nth-child(${nth})`)

        for (const target of [cell, cell.previousElementSibling, cellAbove]) {
            const direction = this._getResizeDirection(target, ev)
            if (direction) return { target, direction }
        }

        return { target: null, direction: null }
    }

    getDynamicActions = anchorNode => [{ act_value: "record_resize_state", act_state: this.config.RECORD_RESIZE, act_name: this.i18n.t("$label.RECORD_RESIZE") }]

    call = action => action === "record_resize_state" && this.toggleRecorder()

    toggleResizer = (enable = true) => {
        const fn = enable ? "addEventListener" : "removeEventListener"
        this.utils.entities.eContent[fn]("mousedown", this._onMouseDown)
    }

    toggleRecorder = (needChange = true) => {
        if (needChange) {
            this.config.RECORD_RESIZE = !this.config.RECORD_RESIZE
        }
        if (this.config.RECORD_RESIZE) {
            this.utils.stateRecorder.register({
                name: this.fixedName,
                selector: "#write th, #write td",
                stateGetter: el => el.style.cssText,
                stateRestorer: (el, state) => el.style.cssText = state,
            })
        } else {
            this.utils.stateRecorder.unregister(this.fixedName)
        }
    }
}

module.exports = {
    plugin: ResizeTablePlugin
}
