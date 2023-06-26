(() => {
    const config = {
        ALLOW_DRAG: false,
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

    const pxToInt = px => parseInt(px.trim().replace("px", ""))

    const whichChildOfParent = child => {
        let i = 1;
        for (const sibling of child.parentElement.children) {
            if (sibling && sibling === child) {
                return i
            }
            i++
        }
    }

    const getMaxPx = (tds, attr) => {
        let max = 0;
        for (const td of tds) {
            const px = td.style[attr];
            if (px) {
                const num = pxToInt(px);
                max = num > max ? num : max;
            }
        }
        return max
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
                    const uncle = _ele.parentElement.previousElementSibling
                    return uncle.querySelector(`td:nth-child(${num})`)
                default:
                    return null
            }
        }
    }

    const findReallyElement = (ele, ev) => {
        let tester = getTester(ele);
        for (let i = 0; i <= 2; i++) {
            const testElement = tester();
            const direction = getDirection(testElement, ev);
            if (direction) {
                return [testElement, direction]
            }
        }
        return [null, ""]
    }

    const write = document.querySelector("#write");
    write.addEventListener("mousedown", ev => {
        if (!metaKeyPressed(ev)) {
            return
        }

        ev.stopPropagation();
        ev.preventDefault();

        let target = ev.target.closest("td");
        if (!target) {
            return
        }

        const rect = target.getBoundingClientRect();
        const startWidth = rect.width;
        const startHeight = rect.height;
        const startX = ev.clientX;
        const startY = ev.clientY;

        const setTds = (tds, attr, value) => {
            if (value) {
                target.style[attr] = value + "px";
                for (const td in tds) {
                    if (td && td.style && td !== target) {
                        td.style[attr] = "";
                    }
                }
            }
        }

        let direction = "";
        [target, direction] = findReallyElement(target, ev);

        if (direction === "right") {
            target.style.cursor = "w-resize";
            const num = whichChildOfParent(target);
            const tds = target.closest("tbody").querySelectorAll(`tr td:nth-child(${num})`);
            const width = getMaxPx(tds, "width");
            setTds(tds, "width", width);
        } else if (direction === "bottom") {
            target.style.cursor = "s-resize";
            const height = getMaxPx(target.parentElement.children, "height");
            setTds(target.parentElement.children, "height", height);
        } else {
            return
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

    console.log("resize_table.js had been injected");
})()