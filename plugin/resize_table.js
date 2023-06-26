(() => {
    const config = {
        DEBUG: true,

        ALLOW_DRAG: true,
        REMOVE_MIX_WIDTH: true,
        THRESHOLD: 20,
    }

    if (!config.ALLOW_DRAG) {
        return
    }

    (() => {
        if (config.REMOVE_MIX_WIDTH) {
            const css = `
            table.md-table td {
                min-width: 1px !important;
            }`
            const style = document.createElement('style');
            style.type = 'text/css';
            style.innerHTML = css;
            document.getElementsByTagName("head")[0].appendChild(style);
        }
    })()

    const metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey;

    const whichChildOfParent = child => {
        let i = 1;
        for (const sibling of child.parentElement.children) {
            if (sibling && sibling === child) {
                return i
            }
            i++
        }
    }

    const getDirection = (target, ev) => {
        const rect = target.getBoundingClientRect();
        if (rect.right - config.THRESHOLD < ev.clientX && ev.clientX < rect.right + config.THRESHOLD) {
            return "right"
        } else if (rect.bottom - config.THRESHOLD < ev.clientY && ev.clientY < rect.bottom + config.THRESHOLD) {
            return "bottom"
        } else {
            return ""
        }
    }

    const getTester = ele => {
        const _ele = ele;
        let count = 0;
        return () => {
            count++
            switch (count) {
                case 1:
                    return _ele
                case 2:
                    return _ele.previousElementSibling
                case 3:
                    const num = whichChildOfParent(_ele);
                    let uncle = _ele.parentElement.previousElementSibling
                    if (uncle) {
                        return uncle.querySelector(`td:nth-child(${num})`)
                    }
                    // 第一行数据
                    const tr = _ele.closest("table").querySelector("thead tr")
                    return tr.querySelector(`th:nth-child(${num})`)
                default:
                    return null
            }
        }
    }

    const findTarget = (ele, ev) => {
        let tester = getTester(ele);
        for (let i = 0; i <= 2; i++) {
            const testElement = tester();
            if (!testElement) {
                continue
            }
            const direction = getDirection(testElement, ev);
            if (direction) {
                return {"target": testElement, "direction": direction}
            }
        }
        return {"target": null, "direction": ""}
    }

    const CleanStyle = (eleList, exclude, cleanStyle) => {
        for (const td of eleList) {
            if (td && td.style && td !== exclude) {
                td.style[cleanStyle] = "";
            }
        }
    }

    const write = document.querySelector("#write");
    write.addEventListener("mousedown", ev => {
        if (!metaKeyPressed(ev)) {
            return
        }
        ev.stopPropagation();
        ev.preventDefault();

        let td = ev.target.closest("td");
        if (!td) {
            return
        }
        const {target, direction} = findTarget(td, ev);
        if ((!target) || (direction !== "right" && direction !== "bottom")) {
            return
        }

        const rect = target.getBoundingClientRect();
        const startWidth = rect.width;
        const startHeight = rect.height;
        const startX = ev.clientX;
        const startY = ev.clientY;

        target.style.width = startWidth + "px";
        target.style.height = startHeight + "px";

        if (direction === "right") {
            // target.style.cursor = "w-resize"; // TODO
            const num = whichChildOfParent(target);
            const tds = target.closest("tbody").querySelectorAll(`tr td:nth-child(${num})`);
            CleanStyle(tds, target, "width");
        } else if (direction === "bottom") {
            // target.style.cursor = "s-resize";
            const tds = target.parentElement.children;
            CleanStyle(tds, target, "height");
        }

        const onMouseMove = ev => {
            ev.stopPropagation();
            ev.preventDefault();

            if (!metaKeyPressed(ev)) {
                return
            }

            requestAnimationFrame(() => {
                if (direction === "right") {
                    target.style.width = startWidth + ev.clientX - startX + "px"
                } else if (direction === "bottom") {
                    target.style.height = startHeight + ev.clientY - startY + "px"
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

    if (config.DEBUG) {
        JSBridge.invoke("window.toggleDevTools")
    }

    console.log("resize_table.js had been injected");
})()