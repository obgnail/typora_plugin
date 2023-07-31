(() => {
    const config = {
        // 默认大纲类型
        DEFAULT_TYPE: "fence",

        LOOP_DETECT_INTERVAL: 30,
    };

    (() => {
        const modal_css = `
            #plugin-outline {
                position: fixed;
                display: none;
                left: 80%;
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
            
            #plugin-outline .plugin-outline-item {
                padding-top: 3px;
                padding-bottom: 3px;
                cursor: pointer;
            }
            
            #plugin-outline .plugin-outline-item.active, .plugin-outline-item:hover {
                border-color: #f5f5f5;
                background-color: var(--item-hover-bg-color);
            }
            
            #plugin-outline .plugin-outline-icon {
                opacity: .7;
                padding: 1px 5px;
                border-radius: 3px;
                cursor: pointer;
            }
            
            #plugin-outline .plugin-outline-icon.select, .plugin-outline-icon:hover {
                background: var(--active-file-bg-color);
                color: var(--active-file-text-color);
                opacity: 1
            }
            
            #plugin-outline .plugin-outline-list {
                height: 400px;
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
        modal.innerHTML = `
            <div class="plugin-outline-header" style="padding-bottom: 5px; border-bottom: solid 1px rgba(0, 0, 0, 0.5);">
                <div class="plugin-outline-icon" type="refresh"><div class="ion-refresh"></div></div>
                <div class="plugin-outline-icon ion-arrow-move" type="move"></div>
                <div class="plugin-outline-icon ion-close" type="close"></div>
            </div>
            <div class="plugin-outline-list"></div>
            <div class="plugin-outline-footer" style="padding-top: 5px; border-top: solid 1px rgba(0, 0, 0, 0.5);">
                <div class="plugin-outline-icon ion-code" type="fence" ty-hint="代码块"></div>
                <div class="plugin-outline-icon ion-image" type="image" ty-hint="图片"></div>
                <div class="plugin-outline-icon ion-grid" type="table" ty-hint="表格"></div>
            </div>
            `
        document.querySelector("header").appendChild(modal);
    })()

    const entities = {
        modal: document.getElementById("plugin-outline"),
        header: document.querySelector("#plugin-outline .plugin-outline-header"),
        list: document.querySelector("#plugin-outline .plugin-outline-list"),
        footer: document.querySelector("#plugin-outline .plugin-outline-footer"),
        move: document.querySelector(`#plugin-outline .plugin-outline-icon[Type="move"]`),
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
        }

        // 简易数据单向绑定
        bindDOM(Type) {
            const first = entities.list.firstElementChild;
            if (first && !first.classList.contains("plugin-outline-item")) {
                entities.list.removeChild(first);
            }

            const typeCollection = this.collection[Type];
            while (typeCollection.length !== entities.list.childElementCount) {
                if (typeCollection.length > entities.list.childElementCount) {
                    const div = document.createElement("div");
                    div.classList.add("plugin-outline-item");
                    div.appendChild(document.createElement("span"));
                    entities.list.appendChild(div);
                } else {
                    entities.list.removeChild(entities.list.firstElementChild);
                }
            }

            if (entities.list.childElementCount === 0) {
                const div = document.createElement("div");
                div.innerText = "Empty";
                div.style.display = "block";
                div.style.textAlign = "center";
                div.style.padding = "10px";
                entities.list.appendChild(div);
                return
            }

            let ele = entities.list.firstElementChild;
            typeCollection.forEach(item => {
                const span = ele.firstElementChild;
                span.setAttribute("data-ref", item.cid);
                span.innerText = `${item.paragraphIdx}-${item.idx}`;
                ele = ele.nextElementSibling;
            })
        }
    }

    const collectUtil = new _collectUtil();

    const collectAndShow = Type => {
        setFooterActive(Type);
        collectUtil.collect();
        collectUtil.bindDOM(Type);
        entities.modal.style.display = "block";
    }

    const Call = () => collectAndShow(config.DEFAULT_TYPE);

    module.exports = {Call, config};

    const scroll = cid => {
        const target = File.editor.findElemById(cid);
        File.editor.focusAndRestorePos();
        File.editor.selection.scrollAdjust(target, 10);
        File.isFocusMode && File.editor.updateFocusMode(false);
    }

    const setFooterActive = Type => {
        for (let ele = entities.footer.firstElementChild; !!ele; ele = ele.nextElementSibling) {
            if (ele.getAttribute("type") === Type) {
                ele.classList.add("select");
            } else {
                ele.classList.remove("select");
            }
        }
    }

    const refresh = () => {
        const search = entities.footer.querySelector(".plugin-outline-icon.select");
        collectAndShow(search.getAttribute("Type"));
    }

    // 因为比较简单,就不用CSS做了
    function rotate(ele) {
        let angle = 0;
        const timer = setInterval(() => {
            angle += 10;
            requestAnimationFrame(() => ele.style.transform = "rotate(" + angle + "deg)");
            (angle === 360) && clearInterval(timer);
        }, 10)
    }

    entities.modal.addEventListener("click", ev => {
        const item = ev.target.closest(".plugin-outline-item");
        const headerIcon = ev.target.closest(".plugin-outline-header .plugin-outline-icon");
        const footerIcon = ev.target.closest(".plugin-outline-footer .plugin-outline-icon");

        if (!item && !headerIcon && !footerIcon) return;

        ev.stopPropagation();
        ev.preventDefault();

        if (item) {
            const cid = item.querySelector("span").getAttribute("data-ref");
            scroll(cid);
        } else if (footerIcon) {
            const Type = footerIcon.getAttribute("type");
            collectAndShow(Type);
        } else {
            const Type = headerIcon.getAttribute("type");
            if (Type === "close") {
                entities.modal.style.display = "none";
            } else if (Type === "refresh") {
                refresh();
                rotate(headerIcon.firstElementChild);
            }
        }
    })

    entities.move.addEventListener("mousedown", ev => {
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
            entities.move.onmouseup = null;
        })

        document.addEventListener('mousemove', onMouseMove);
    })
    entities.move.ondragstart = () => false

    const _timer = setInterval(() => {
        if (File) {
            clearInterval(_timer);
            const decorator = (original, after) => {
                return function () {
                    const result = original.apply(this, arguments);
                    after.call(this, result, ...arguments);
                    return result;
                };
            }
            const after = () => (entities.modal.style.display === "block") && setTimeout(refresh, 300)
            File.editor.library.openFile = decorator(File.editor.library.openFile, after);
        }
    }, config.LOOP_DETECT_INTERVAL);

    console.log("outline.js had been injected");
})()