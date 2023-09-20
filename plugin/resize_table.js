class resizeTablePlugin extends global._basePlugin {
    style = () => {
        if (this.config.REMOVE_MIX_WIDTH) {
            return `table.md-table td { min-width: 1px !important; }`;
        }
    }

    process = () => {
        if (this.config.RECORD_RESIZE) {
            new resizeRecorder(this).process();
        }

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
                const num = this.whichChildOfParent(target);
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

    whichChildOfParent = child => {
        let i = 1;
        for (const sibling of child.parentElement.children) {
            if (sibling && sibling === child) {
                return i
            }
            i++
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
        let target = null;
        let direction = "";

        for (let i = 1; i <= 3; i++) {
            switch (i) {
                case 1:
                    target = ele;
                    break
                case 2:
                    target = ele.previousElementSibling;
                    break
                case 3:
                    const num = this.whichChildOfParent(ele);
                    const uncle = ele.parentElement.previousElementSibling;
                    if (uncle) {
                        target = uncle.querySelector(`td:nth-child(${num})`);
                    } else {
                        // 第一行数据
                        const tr = ele.closest("table").querySelector("thead tr");
                        target = tr.querySelector(`th:nth-child(${num})`);
                    }
                    break
            }

            direction = this.getDirection(target, ev);
            if (target && direction) break
        }

        return {target, direction}
    }

    cleanStyle = (eleList, exclude, cleanStyle) => {
        for (const td of eleList) {
            if (td && td.style && td !== exclude) {
                td.style[cleanStyle] = "";
            }
        }
    }
}

class resizeRecorder {
    constructor(controller) {
        this.utils = controller.utils;
    }

    collect = () => {
        const resizeIdxMap = new Map();
        document.querySelectorAll("#write th,td").forEach((cell, idx) => {
            const style = cell.style.cssText;
            style && resizeIdxMap.set(idx, style);
        })
        if (resizeIdxMap.size) {
            return resizeIdxMap
        }
    }

    resizeTable = (filepath, resizeIdxMap) => {
        let targetIdx = 0
        document.querySelectorAll("#write th,td").forEach((img, idx) => {
            const style = resizeIdxMap.get(idx);
            if (style) {
                img.style = style;
                targetIdx++;
            }
        })
    }

    process = () => this.utils.registerStateRecorder(this.collect, this.resizeTable);
}

module.exports = {
    plugin: resizeTablePlugin
};