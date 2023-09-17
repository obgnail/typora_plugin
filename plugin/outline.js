class outlinePlugin extends global._basePlugin {
    style = () => {
        return `
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
                background-color: var(--item-hover-bg-color) !important;
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
    }

    html = () => {
        const all_button = (this.config.USE_ALL) ? `<div class="plugin-outline-icon ion-android-data" type="all" ty-hint="混合"></div>` : "";
        const class_name = (this.config.SHOW_HIDDEN) ? "ion-eye" : "ion-eye-disabled";
        const hint = (this.config.SHOW_HIDDEN) ? "显示被其他插件隐藏的元素" : "不显示被其他插件隐藏的元素";

        const modal = document.createElement("div");
        modal.id = 'plugin-outline';
        modal.innerHTML = `
            <div class="plugin-outline-header" style="padding-bottom: 5px; border-bottom: solid 1px rgba(0, 0, 0, 0.5);">
                <div class="plugin-outline-icon ${class_name} select" type="eye" ty-hint="${hint}"></div>
                <div class="plugin-outline-icon" type="refresh"><div class="ion-refresh"></div></div>
                <div class="plugin-outline-icon ion-arrow-move" type="move"></div>
                <div class="plugin-outline-icon ion-close" type="close"></div>
            </div>
            <div class="plugin-outline-list"></div>
            <div class="plugin-outline-footer" style="padding-top: 5px; border-top: solid 1px rgba(0, 0, 0, 0.5);">
                <div class="plugin-outline-icon ion-code" type="fence" ty-hint="代码块"></div>
                <div class="plugin-outline-icon ion-image" type="image" ty-hint="图片"></div>
                <div class="plugin-outline-icon ion-grid" type="table" ty-hint="表格"></div>
                ${all_button}
            </div>
            `
        this.utils.insertDiv(modal);
    }

    init = () => {
        this.entities = {
            modal: document.getElementById("plugin-outline"),
            header: document.querySelector("#plugin-outline .plugin-outline-header"),
            list: document.querySelector("#plugin-outline .plugin-outline-list"),
            footer: document.querySelector("#plugin-outline .plugin-outline-footer"),
            move: document.querySelector(`#plugin-outline .plugin-outline-icon[Type="move"]`),
        }
        this.collectUtil = new _collectUtil(this.config, this.entities);
    }

    process = () => {
        this.init();

        this.utils.dragFixedModal(this.entities.move, this.entities.modal, false);

        this.utils.addEventListener(this.utils.eventType.fileOpened, () => {
            (this.config.AUTO_REFRESH_WHEN_OPEN_FILE && this.entities.modal.style.display === "block") && setTimeout(this.refresh, 300);
        });

        this.entities.modal.addEventListener("click", ev => {
            const item = ev.target.closest(".plugin-outline-item");
            const headerIcon = ev.target.closest(".plugin-outline-header .plugin-outline-icon");
            const footerIcon = ev.target.closest(".plugin-outline-footer .plugin-outline-icon");

            if (!item && !headerIcon && !footerIcon) return;

            ev.stopPropagation();
            ev.preventDefault();

            if (item) {
                const cid = item.querySelector("span").getAttribute("data-ref");
                this.scroll(cid);
            } else if (footerIcon) {
                const Type = footerIcon.getAttribute("type");
                this.collectAndShow(Type);
            } else {
                const Type = headerIcon.getAttribute("type");
                if (Type === "close") {
                    this.hide();
                } else if (Type === "refresh") {
                    this.refresh();
                    this.rotate(headerIcon.firstElementChild);
                } else if (Type === "eye") {
                    this.toggleEye(headerIcon);
                    this.refresh();
                }
            }
        })
    }

    collectAndShow = Type => {
        this.setFooterActive(Type);
        this.collectUtil.collect();
        this.collectUtil.bindDOM(Type);
        this.entities.modal.style.display = "block";
    }

    scroll = cid => {
        const target = File.editor.findElemById(cid);
        this.utils.showHiddenElementByPlugin(target[0]);
        this.utils.scroll(target);
    }

    setFooterActive = Type => {
        for (let ele = this.entities.footer.firstElementChild; !!ele; ele = ele.nextElementSibling) {
            if (ele.getAttribute("type") === Type) {
                ele.classList.add("select");
            } else {
                ele.classList.remove("select");
            }
        }
    }

    refresh = () => {
        if (this.entities.modal.style.display === "block") {
            const search = this.entities.footer.querySelector(".plugin-outline-icon.select");
            this.collectAndShow(search.getAttribute("Type"));
        }
    }

    // 因为比较简单,就不用CSS做了
    rotate = ele => {
        let angle = 0;
        const timer = setInterval(() => {
            angle += 10;
            requestAnimationFrame(() => ele.style.transform = "rotate(" + angle + "deg)");
            (angle === 360) && clearInterval(timer);
        }, 10)
    }

    toggleEye = icon => {
        this.config.SHOW_HIDDEN = !this.config.SHOW_HIDDEN;
        if (icon.classList.contains("ion-eye")) {
            icon.classList.remove("ion-eye");
            icon.classList.add("ion-eye-disabled");
            icon.setAttribute("ty-hint", "不显示被其他插件隐藏的元素");
        } else {
            icon.classList.remove("ion-eye-disabled");
            icon.classList.add("ion-eye");
            icon.setAttribute("ty-hint", "显示被其他插件隐藏的元素");
        }
    }

    call = () => {
        if (this.entities.modal.style.display === "block") {
            this.hide();
        } else {
            this.collectAndShow(this.config.DEFAULT_TYPE);
        }
    };

    hide = () => this.entities.modal.style.display = "none";
}

class _collectUtil {
    constructor(config, entities) {
        this.config = config;
        this.entities = entities;

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
        const elements = document.querySelectorAll("#write>h1, #write>h2, .md-table, .md-fences, .md-image");
        elements.forEach(ele => {
            if (!this.config.SHOW_HIDDEN && ele.style.display === "none") return;

            const tagName = ele.tagName;
            if (tagName === "H1") {
                this.paragraphIdx = 0;
                this.tableIdx = this.imageIdx = this.fenceIdx = 0;
                return;
            } else if (tagName === "H2") {
                this.paragraphIdx++;
                this.tableIdx = this.imageIdx = this.fenceIdx = 0;
                return;
            }

            const cid = ele.closest("[cid]").getAttribute("cid");
            // table
            if (ele.classList.contains("md-table")) {
                this.tableIdx++;
                this.collection.table.push({
                    cid: cid,
                    type: "table",
                    paragraphIdx: this.paragraphIdx,
                    idx: this.tableIdx
                });
                // fence
            } else if (ele.classList.contains("md-fences")) {
                this.fenceIdx++;
                this.collection.fence.push({
                    cid: cid,
                    type: "fence",
                    paragraphIdx: this.paragraphIdx,
                    idx: this.fenceIdx
                });
                // image
            } else if (ele.classList.contains("md-image")) {
                this.imageIdx++;
                this.collection.image.push({
                    cid: cid,
                    type: "image",
                    paragraphIdx: this.paragraphIdx,
                    idx: this.imageIdx
                });
            }
        })
    }

    compare(p) {
        return function (m, n) {
            const cid1 = parseInt(m[p].replace("n", ""));
            const cid2 = parseInt(n[p].replace("n", ""));
            return cid1 - cid2;
        }
    }

    getCollection(Type) {
        if (Type !== "all") {
            return this.collection[Type]
        }
        let list = [];
        for (const type in this.collection) {
            list.push(...this.collection[type])
        }
        list.sort(this.compare("cid"));
        return list
    }

    setColor = (ele, item, type) => {
        if (type === "all") {
            if (item.type === "table") {
                ele.style.backgroundColor = "aliceblue";
            } else if (item.type === "fence") {
                ele.style.backgroundColor = "antiquewhite";
            } else if (item.type === "image") {
                ele.style.backgroundColor = "beige";
            }
        } else {
            ele.style.backgroundColor = "";
        }
    }

    // 简易数据单向绑定
    bindDOM(Type) {
        const typeCollection = this.getCollection(Type);

        const first = this.entities.list.firstElementChild;
        if (first && !first.classList.contains("plugin-outline-item")) {
            this.entities.list.removeChild(first);
        }

        while (typeCollection.length !== this.entities.list.childElementCount) {
            if (typeCollection.length > this.entities.list.childElementCount) {
                const div = document.createElement("div");
                div.classList.add("plugin-outline-item");
                div.appendChild(document.createElement("span"));
                this.entities.list.appendChild(div);
            } else {
                this.entities.list.removeChild(this.entities.list.firstElementChild);
            }
        }

        if (this.entities.list.childElementCount === 0) {
            const div = document.createElement("div");
            div.innerText = "Empty";
            div.style.display = "block";
            div.style.textAlign = "center";
            div.style.padding = "10px";
            this.entities.list.appendChild(div);
            return
        }

        let ele = this.entities.list.firstElementChild;
        typeCollection.forEach(item => {
            if (this.config.SET_COLOR_IN_ALL) {
                this.setColor(ele, item, Type);
            }
            const span = ele.firstElementChild;
            span.setAttribute("data-ref", item.cid);
            span.innerText = `${this.config.SHOW_NAME[item.type]} ${item.paragraphIdx}-${item.idx}`;
            ele = ele.nextElementSibling;
        })
    }
}

module.exports = {
    plugin: outlinePlugin
};

