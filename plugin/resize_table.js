class resizeTablePlugin extends global._basePlugin {
    style = () => {
        if (this.config.REMOVE_MIX_WIDTH) {
            return `table.md-table td { min-width: 1px !important; }`;
        }
    }

    process = () => {
        this.recordResizeState(false);
        document.querySelector("#write").addEventListener("mousedown", ev => {
            if (!this.utils.metaKeyPressed(ev)) return;
            ev.stopPropagation();
            ev.preventDefault();

            let closet = "thead";
            let self = "th";
            let ele = ev.target.closest(self);
            if (!ele) {
                closet = "tbody";
                self = "td";
                ele = ev.target.closest(self);
            }

            if (!ele) return;

            const {target, direction} = this.findTarget(ele, ev);
            if ((!target) || (direction !== "right" && direction !== "bottom")) return;

            const rect = target.getBoundingClientRect();
            const startWidth = rect.width;
            const startHeight = rect.height;
            const startX = ev.clientX;
            const startY = ev.clientY;

            target.style.width = startWidth + "px";
            target.style.height = startHeight + "px";

            if (direction === "right") {
                target.style.cursor = "w-resize";
                const num = this.utils.whichChildOfParent(target);
                const eleList = target.closest(closet).querySelectorAll(`tr ${self}:nth-child(${num})`);
                this.cleanStyle(eleList, target, "width");
            } else if (direction === "bottom") {
                target.style.cursor = "s-resize";
                const tds = target.parentElement.children;
                this.cleanStyle(tds, target, "height");
            }

            const onMouseMove = ev => {
                ev.stopPropagation();
                ev.preventDefault();

                if (!this.utils.metaKeyPressed(ev)) return;

                requestAnimationFrame(() => {
                    if (direction === "right") {
                        target.style.width = startWidth + ev.clientX - startX + "px";
                    } else if (direction === "bottom") {
                        target.style.height = startHeight + ev.clientY - startY + "px";
                    }
                });
            }

            document.addEventListener("mouseup", ev => {
                    ev.stopPropagation();
                    ev.preventDefault();
                    target.style.cursor = "default";
                    document.removeEventListener('mousemove', onMouseMove);
                    target.onmouseup = null;
                }
            )

            document.addEventListener('mousemove', onMouseMove);
        })
    }

    dynamicCallArgsGenerator = anchorNode => {
        return [{arg_name: `${this.config.RECORD_RESIZE ? "不" : ""}记住表格放缩状态`, arg_value: "record_resize_state"}];
    }

    call = type => {
        if (type === "record_resize_state") {
            this.recordResizeState();
        }
    }

    recordResizeState = (needChange = true) => {
        if (needChange) {
            this.config.RECORD_RESIZE = !this.config.RECORD_RESIZE;
        }
        const name = "recordResizeTable";
        if (this.config.RECORD_RESIZE) {
            this.utils.registerStateRecorder(name, "#write th,td",
                ele => ele.style.cssText, (ele, state) => ele.style = state);
        } else {
            this.utils.unregisterStateRecorder(name);
        }
    }

    getDirection = (target, ev) => {
        if (!target) return ""
        const rect = target.getBoundingClientRect();
        if (rect.right - this.config.THRESHOLD < ev.clientX && ev.clientX < rect.right + this.config.THRESHOLD) {
            return "right"
        } else if (rect.bottom - this.config.THRESHOLD < ev.clientY && ev.clientY < rect.bottom + this.config.THRESHOLD) {
            return "bottom"
        } else {
            return ""
        }
    }

    findTarget = (ele, ev) => {
        const that = this;

        function* find(ele) {
            // 自己
            yield ele
            // 左边
            yield ele.previousElementSibling
            // 上边
            const num = that.utils.whichChildOfParent(ele);
            const uncle = ele.parentElement.previousElementSibling;
            yield (uncle)
                // td
                ? uncle.querySelector(`td:nth-child(${num})`)
                // tr
                : ele.closest("table").querySelector("thead tr").querySelector(`th:nth-child(${num})`)
        }

        for (const target of find(ele)) {
            const direction = this.getDirection(target, ev);
            if (target && direction) {
                return {target, direction}
            }
        }
        return {target: null, direction: ""}
    }

    cleanStyle = (eleList, exclude, cleanStyle) => {
        for (const td of eleList) {
            if (td && td.style && td !== exclude) {
                td.style[cleanStyle] = "";
            }
        }
    }
}

module.exports = {
    plugin: resizeTablePlugin
};