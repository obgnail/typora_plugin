(() => {
    const config = {
        ALLOW_DRAG: true,
        NAME: {
            table: "", // Table
            image: "", // Figure
            fence: "", // Fence
        },
        DEFAULT_TYPE: "fence",
    };

    (() => {
        const modal_css = `
            #plugin-outline {
                position: fixed;
                display: none;
                left: 90%;
                top: 25%;
                padding: 4px 5px;
                width: 150px;
                z-index: 9999;
                background-color: #ffffff;
                box-shadow: 0 4px 10px rgba(0, 0, 0, .5);
                border: 1px solid #ddd;
            }
            
            #plugin-outline .plugin-outline-header, .plugin-outline-footer {
                display: inline-flex;
                justify-content: space-evenly;
                align-items: center;
                width: 100%;
            }
            
            #plugin-outline .plugin-outline-header {
                padding-bottom: 5px;
                border-bottom: solid 1px rgba(0, 0, 0, 0.5);
            }
            
            #plugin-outline .plugin-outline-footer {
                padding-top: 5px;
                border-top: solid 1px rgba(0, 0, 0, 0.5);
            }
            
            #plugin-outline .plugin-outline-icon {
                opacity: .7;
                padding: 1px 5px;
                border-radius: 3px;
                cursor: pointer;
            }
            
            #plugin-outline .plugin-outline-icon.select,
            #plugin-outline .plugin-outline-icon:hover {
                background: var(--active-file-bg-color);
                color: var(--active-file-text-color);
                opacity: 1
            }
            
            #plugin-outline .plugin-outline-list {
                max-height: 400px;
                padding: 1px 0px;
                overflow-x: hidden;
                overflow-y: auto;
            }
            
            #plugin-outline .plugin-outline-list span {
                display: block;
                text-align: center;
            }
        `
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = modal_css;
        document.getElementsByTagName("head")[0].appendChild(style);

        const modal = document.createElement("div");
        modal.id = 'plugin-outline';
        modal.classList.add("outline-content");
        modal.innerHTML = `
            <div class="plugin-outline-header">
                <div class="plugin-outline-icon ion-code" type="fence" ty-hint="代码块"></div>
                <div class="plugin-outline-icon ion-image" type="image" ty-hint="图片"></div>
                <div class="plugin-outline-icon ion-grid" type="table" ty-hint="表格"></div>
            </div>
            <div class="plugin-outline-list"></div>
            <div class="plugin-outline-footer">
                <div class="plugin-outline-icon ion-refresh" type="refresh" ty-hint="刷新"></div>
                <div class="plugin-outline-icon ion-arrow-move" type="move" ty-hint="移动"></div>
                <div class="plugin-outline-icon ion-close" type="close" ty-hint="关闭"></div>
            </div>
            `
        document.querySelector("header").appendChild(modal);
    })()

    const entities = {
        modal: document.getElementById("plugin-outline"),
        header: document.querySelector("#plugin-outline .plugin-outline-header"),
        list: document.querySelector("#plugin-outline .plugin-outline-list"),
        footer: document.querySelector("#plugin-outline .plugin-outline-footer"),
    }

    const newItem = (cid, name, active) => {
        const _active = (active) ? "outline-item-active" : "";
        return `<li class="outline-item-wrapper outline-h1"><div class="outline-item ${_active}"><span data-ref="${cid}">${name}</span></div></li>`
    }

    const setHeaderActive = Type => {
        for (let ele = entities.header.firstElementChild; !!ele; ele = ele.nextElementSibling) {
            if (ele.getAttribute("type") === Type) {
                ele.classList.add("select");
            } else {
                ele.classList.remove("select");
            }
        }
    }

    class _collectUtil {
        constructor() {
            this.paragraphIdx = 0;
            this.tableIdx = 0;
            this.imageIdx = 0;
            this.fenceIdx = 0;
            this.collection = {table: [], image: [], fence: []};
        }

        clear() {
            this.paragraphIdx = this.tableIdx = this.imageIdx = this.fenceIdx = 0;
            this.collection = {table: [], image: [], fence: []};
        }

        collect() {
            this.clear();
            const write = document.querySelector("#write");
            for (let ele = write.firstElementChild; ele; ele = ele.nextElementSibling) {
                const tagName = ele.tagName;
                if (tagName === "H1") {
                    this.paragraphIdx = 0;
                    this.tableIdx = this.imageIdx = this.fenceIdx = 0;
                    continue
                } else if (tagName === "H2") {
                    this.paragraphIdx++;
                    this.tableIdx = this.imageIdx = this.fenceIdx = 0;
                    continue
                }

                const cid = ele.getAttribute("cid");
                // table
                if (tagName === "FIGURE") {
                    this.tableIdx++;
                    this.collection.table.push({cid: cid, paragraphIdx: this.paragraphIdx, idx: this.tableIdx});
                    // fence
                } else if (ele.classList.contains("md-fences")) {
                    this.fenceIdx++;
                    this.collection.fence.push({cid: cid, paragraphIdx: this.paragraphIdx, idx: this.fenceIdx});
                    // image
                } else if (ele.querySelector("img")) {
                    this.imageIdx++;
                    this.collection.image.push({cid: cid, paragraphIdx: this.paragraphIdx, idx: this.imageIdx});
                }
            }
            return this.collection
        }
    }

    const collectUtil = new _collectUtil();

    const collectAndShow = Type => {
        const collection = collectUtil.collect();
        const li = collection[Type].map(item => newItem(item.cid, `${config.NAME[Type]} ${item.paragraphIdx}-${item.idx}`))
        setHeaderActive(Type);
        entities.modal.style.display = "block";
        entities.list.innerHTML = li.join("\n");
    }

    const Call = () => collectAndShow(config.DEFAULT_TYPE);

    module.exports = {Call, config};

    const scroll = cid => {
        const target = File.editor.findElemById(cid);
        File.editor.focusAndRestorePos();
        File.editor.selection.scrollAdjust(target, 10);
        File.isFocusMode && File.editor.updateFocusMode(false);
    }

    entities.modal.addEventListener("click", ev => {
        const target = ev.target.closest(".outline-item-wrapper");
        if (!target) return;

        ev.stopPropagation();
        ev.preventDefault();

        const cid = target.querySelector("span").getAttribute("data-ref");
        scroll(cid);
    })

    entities.header.addEventListener("click", ev => {
        const target = ev.target.closest(".plugin-outline-icon");
        if (!target) return;

        ev.stopPropagation();
        ev.preventDefault();

        const Type = target.getAttribute("type");
        collectAndShow(Type);
    })

    entities.footer.addEventListener("click", ev => {
        const target = ev.target.closest(".plugin-outline-icon");
        if (!target) return;

        ev.stopPropagation();
        ev.preventDefault();

        const Type = target.getAttribute("type");
        if (Type === "close") {
            entities.modal.style.display = "none";
        } else if (Type === "refresh") {
            const search = entities.header.querySelector(".plugin-outline-icon.select");
            collectAndShow(search.getAttribute("Type"));
        }
    })

    if (config.ALLOW_DRAG) {
        const move = entities.footer.querySelector(`.plugin-outline-icon[Type="move"]`);
        move.addEventListener("mousedown", ev => {
            ev.stopPropagation();
            const rect = entities.modal.getBoundingClientRect();
            const shiftX = ev.clientX - rect.left;
            const shiftY = ev.clientY - rect.top;

            const onMouseMove = ev => {
                ev.stopPropagation();
                ev.preventDefault();
                requestAnimationFrame(() => {
                    entities.modal.style.left = ev.clientX - shiftX + 'px';
                    entities.modal.style.top = ev.clientY - shiftY + 'px';
                });
            }

            document.addEventListener("mouseup", ev => {
                    ev.stopPropagation();
                    ev.preventDefault();
                    document.removeEventListener('mousemove', onMouseMove);
                    move.onmouseup = null;
                }
            )

            document.addEventListener('mousemove', onMouseMove);
        })
        move.ondragstart = () => false
    }

    console.log("outline.js had been injected");
})()