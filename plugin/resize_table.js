class resizeTablePlugin extends BasePlugin {
    styleTemplate = () => this.config.REMOVE_MIX_WIDTH

    process = () => {
        this.toggleRecorder(false);
        this.onResize();
    }

    dynamicCallArgsGenerator = anchorNode => [{
        arg_name: `${this.config.RECORD_RESIZE ? "不" : ""}记住表格放缩状态`,
        arg_value: "record_resize_state"
    }]

    call = type => type === "record_resize_state" && this.toggleRecorder();

    onResize = () => {
        document.querySelector("#write").addEventListener("mousedown", ev => {
            if (!this.utils.metaKeyPressed(ev)) return;
            ev.stopPropagation();
            ev.preventDefault();

            const ele = ev.target.closest("th, td");
            if (!ele) return;
            const tag = ele.tagName;
            const closestElement = tag === "TD" ? "tbody" : "thead";
            const {target, direction} = this.findTarget(ele, ev);
            if (!target || !direction) return;

            const {width: startWidth, height: startHeight} = target.getBoundingClientRect();
            const {clientX: startX, clientY: startY} = ev;
            target.style.width = startWidth + "px";
            target.style.height = startHeight + "px";

            if (direction === "right") {
                target.style.cursor = "w-resize";
                const num = this.utils.whichChildOfParent(target);
                const eleList = target.closest(closestElement).querySelectorAll(`tr ${tag}:nth-child(${num})`);
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

    toggleRecorder = (needChange = true) => {
        if (needChange) {
            this.config.RECORD_RESIZE = !this.config.RECORD_RESIZE;
        }
        const name = "recordResizeTable";
        const selector = "#write th, #write td";
        const stateGetter = ele => ele.style.cssText
        const stateRestorer = (ele, state) => ele.style = state
        if (this.config.RECORD_RESIZE) {
            this.utils.registerStateRecorder(name, selector, stateGetter, stateRestorer);
        } else {
            this.utils.unregisterStateRecorder(name);
        }
    }

    getDirection = (target, ev) => {
        if (!target) return ""
        const {right, bottom} = target.getBoundingClientRect();
        const {clientX, clientY} = ev;
        const {THRESHOLD} = this.config;
        if (right - THRESHOLD < clientX && clientX < right + THRESHOLD) {
            return "right"
        } else if (bottom - THRESHOLD < clientY && clientY < bottom + THRESHOLD) {
            return "bottom"
        } else {
            return ""
        }
    }

    findTarget = (ele, ev) => {
        const {utils} = this;

        function* find(ele) {
            // 自己
            yield ele
            // 左边
            yield ele.previousElementSibling
            // 上边
            const num = utils.whichChildOfParent(ele);
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