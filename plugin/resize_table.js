class resizeTablePlugin extends BasePlugin {
    styleTemplate = () => this.config.REMOVE_MIX_WIDTH

    process = () => {
        this.utils.runtime.autoSaveConfig(this);
        this.toggleRecorder(false);
        this.onResize();
    }

    dynamicCallArgsGenerator = anchorNode => [{
        arg_name: "记住表格放缩状态",
        arg_value: "record_resize_state",
        arg_state: this.config.RECORD_RESIZE
    }]

    call = type => type === "record_resize_state" && this.toggleRecorder();

    onResize = () => {
        this.utils.entities.eWrite.addEventListener("mousedown", ev => {
            if (!this.utils.metaKeyPressed(ev)) return;
            ev.stopPropagation();
            ev.preventDefault();

            const ele = ev.target.closest("th, td");
            if (!ele) return;
            const tag = ele.tagName;
            const closestElement = tag === "TD" ? "tbody" : "thead";
            const { target, direction } = this.findTarget(ele, ev);
            if (!target || !direction) return;

            const { width: startWidth, height: startHeight } = target.getBoundingClientRect();
            const { clientX: startX, clientY: startY } = ev;
            target.style.width = startWidth + "px";
            target.style.height = startHeight + "px";
            target.style.cursor = direction === "right" ? "w-resize" : "s-resize";

            if (direction === "right") {
                const num = this.indexOfParent(target);
                const eleList = target.closest(closestElement).querySelectorAll(`tr ${tag}:nth-child(${num})`);
                this.cleanStyle(eleList, target, "width");
            } else if (direction === "bottom") {
                const tds = target.parentElement.children;
                this.cleanStyle(tds, target, "height");
            }

            const onMouseMove = ev => {
                if (!this.utils.metaKeyPressed(ev)) return;
                requestAnimationFrame(() => {
                    if (direction === "right") {
                        target.style.width = startWidth + ev.clientX - startX + "px";
                    } else if (direction === "bottom") {
                        target.style.height = startHeight + ev.clientY - startY + "px";
                    }
                });
            }
            const onMouseUp = ev => {
                target.style.cursor = "default";
                target.onmouseup = null;
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            }

            document.addEventListener("mouseup", onMouseUp);
            document.addEventListener("mousemove", onMouseMove);
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
            this.utils.stateRecorder.register(name, selector, stateGetter, stateRestorer);
        } else {
            this.utils.stateRecorder.unregister(name);
        }
    }

    getDirection = (target, ev) => {
        if (!target) return ""
        const { right, bottom } = target.getBoundingClientRect();
        const { clientX, clientY } = ev;
        const { THRESHOLD } = this.config;
        if (right - THRESHOLD < clientX && clientX < right + THRESHOLD) {
            return "right"
        } else if (bottom - THRESHOLD < clientY && clientY < bottom + THRESHOLD) {
            return "bottom"
        } else {
            return ""
        }
    }

    indexOfParent = child => Array.prototype.indexOf.call(child.parentElement.children, child) + 1

    findTarget = (ele, ev) => {
        const nth = this.indexOfParent(ele);
        const uncle = ele.parentElement.previousElementSibling;
        // [自己, 左边, 上边]
        const targets = [
            ele,
            ele.previousElementSibling,
            uncle
                ? uncle.querySelector(`td:nth-child(${nth})`)
                : ele.closest("table").querySelector("thead tr").querySelector(`th:nth-child(${nth})`)
        ];
        for (const target of targets) {
            const direction = this.getDirection(target, ev);
            if (target && direction) {
                return { target, direction };
            }
        }
        return { target: null, direction: "" };
    };

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