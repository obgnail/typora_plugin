(() => {
    const config = {
        ALLOW_DRAG: true,
        threshold: 10,
    }

    if (!config.ALLOW_DRAG) {
        return
    }

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

    const getDirection = (rect, ev) => {
        if (ev.clientX > rect.right - config.threshold) {
            return "right"
        } else if (ev.clientX < rect.left + config.threshold) {
            return "left"
        } else if (ev.clientY > rect.bottom - config.threshold) {
            return "bottom"
        } else if (ev.clientY < rect.top + config.threshold) {
            return "top"
        } else {
            return ""
        }
    }

    document.querySelector("#write").addEventListener("mousedown", ev => {
        if (!metaKeyPressed(ev)) {
            return
        }

        ev.stopPropagation();
        ev.preventDefault();

        const target = ev.target.closest("td");
        if (!target) {
            return
        }

        const rect = target.getBoundingClientRect();
        const shiftX = rect.width - ev.clientX;
        const shiftY = rect.height - ev.clientY;

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

        const direction = getDirection(rect, ev);
        switch (direction) {
            case "right":
            case "left":
                target.style.cursor = "w-resize";
                const num = whichChildOfParent(target);
                const tds = target.closest("tbody").querySelectorAll(`tr td:nth-child(${num})`);
                const width = getMaxPx(tds, "width");
                setTds(tds, "width", width);
                break
            case "bottom":
            case "top":
                target.style.cursor = "s-resize";
                const height = getMaxPx(target.parentElement.children, "height");
                setTds(target.parentElement.children, "height", height);
                break
            case "":
                return
        }

        const onMouseMove = ev => {
            ev.stopPropagation();
            ev.preventDefault();

            if (!metaKeyPressed(ev)) {
                return
            }

            requestAnimationFrame(() => {
                if (direction === "bottom" || direction === "top") {
                    target.style.height = ev.clientY + shiftY + "px";
                } else {
                    target.style.width = ev.clientX + shiftX + "px";
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