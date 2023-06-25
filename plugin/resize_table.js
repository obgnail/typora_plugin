(() => {
    const config = {
        ALLOW_DRAG: true,
        threshold: 10,
    }

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


    if (config.ALLOW_DRAG) {
        const write = document.querySelector("#write");

        write.addEventListener("mousedown", ev => {
            const target = ev.target.closest("td");
            if (!target) {
                return
            }

            let direction = "";
            const rect = target.getBoundingClientRect();
            const startWidth = rect.width;
            const startHeight = rect.height;
            const startX = ev.clientX;
            const startY = ev.clientY;

            if ((ev.clientX > rect.right - config.threshold) || (ev.clientX < rect.left + config.threshold)) {
                direction = "horizontal";
                target.style.cursor = "w-resize"

                const num = whichChildOfParent(target);
                const tbody = target.closest("tbody");
                const tds = tbody.querySelectorAll(`tr td:nth-child(${num})`);
                const width = getMaxPx(tds, "width");
                if (width) {
                    target.style.width = width + "px";
                    for (const td in tds) {
                        if (td && td.style && td !== target) {
                            td.style.width = "";
                        }
                    }
                }

            } else if ((ev.clientY > rect.bottom - config.threshold) || ev.clientY < rect.top + config.threshold) {
                direction = "vertical";
                target.style.cursor = "s-resize"

                const height = getMaxPx(target.parentElement.children, "height");

                if (height) {
                    target.style.height = height + "px";
                    for (const td in target.parentElement.children) {
                        if (td && td.style && td !== target) {
                            td.style.height = "";
                        }
                    }
                }
            } else {
                return
            }

            const onMouseMove = ev => {
                ev.stopPropagation();
                ev.preventDefault();
                if (direction === "vertical") {
                    requestAnimationFrame(() => target.style.height = startHeight + ev.clientY - startY + "px");
                } else if (direction === "horizontal") {
                    requestAnimationFrame(() => target.style.width = startWidth + ev.clientX - startX + "px");
                }
            }

            document.addEventListener("mouseup", ev => {
                    ev.stopPropagation();
                    ev.preventDefault();
                    document.removeEventListener('mousemove', onMouseMove);
                    target.onmouseup = null;
                    target.style.cursor = "default";
                }
            )

            document.addEventListener('mousemove', onMouseMove);
        })
    }

    console.log("resize_table.js had been injected");
})()