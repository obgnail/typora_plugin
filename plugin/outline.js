class outlinePlugin extends BasePlugin {
    styleTemplate = () => this

    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    html = () => {
        const [className, hint] = this.config.SHOW_HIDDEN ? ["ion-eye", "显示被其他插件隐藏的元素"] : ["ion-eye-disabled", "不显示被其他插件隐藏的元素"];
        return `
            <div id="plugin-outline" class="plugin-common-modal plugin-common-hidden">
                <div class="plugin-outline-header">
                    <div class="plugin-outline-icon ${className}" type="eye" ty-hint="${hint}"></div>
                    <div class="plugin-outline-icon ion-arrow-move" type="move" ty-hint="移动"></div>
                    <div class="plugin-outline-icon ion-close" type="close" ty-hint="关闭"></div>
                </div>
                <div class="plugin-outline-list"></div>
                <div class="plugin-outline-footer">
                    <div class="plugin-outline-icon ion-code" type="fence" ty-hint="代码块"></div>
                    <div class="plugin-outline-icon ion-image" type="image" ty-hint="图片"></div>
                    <div class="plugin-outline-icon ion-grid" type="table" ty-hint="表格"></div>
                    <div class="plugin-outline-icon ion-link" type="link" ty-hint="链接"></div>
                    <div class="plugin-outline-icon ion-pound" type="math" ty-hint="公式"></div>
                    ${this.config.USE_ALL ? '<div class="plugin-outline-icon ion-android-data" type="all" ty-hint="混合"></div>' : ""}
                </div>
            </div>
        `
    }

    init = () => {
        this.entities = {
            modal: document.getElementById("plugin-outline"),
            header: document.querySelector("#plugin-outline .plugin-outline-header"),
            list: document.querySelector("#plugin-outline .plugin-outline-list"),
            footer: document.querySelector("#plugin-outline .plugin-outline-footer"),
            move: document.querySelector(`#plugin-outline .plugin-outline-icon[Type="move"]`),
        }
        this.collectUtil = new collectUtil(this);
    }

    process = () => {
        this.utils.dragFixedModal(this.entities.move, this.entities.modal, false);

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.outlineUpdated, this.update);
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.otherFileOpened, () => this.config.AUTO_REFRESH_WHEN_OPEN_FILE && setTimeout(this.update, 300));
        // 旧版本的Typora的outlineUpdated事件很难触发
        if (this.utils.isBetaVersion) {
            this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileEdited, this.utils.throttle(this.update, 300));
        }

        this.entities.modal.addEventListener("click", ev => {
            const item = ev.target.closest(".plugin-outline-item");
            const headerIcon = ev.target.closest(".plugin-outline-header .plugin-outline-icon");
            const footerIcon = ev.target.closest(".plugin-outline-footer .plugin-outline-icon");

            if (!item && !headerIcon && !footerIcon) return;

            if (item) {
                const cid = item.querySelector("span").getAttribute("data-ref");
                this.utils.scrollByCid(cid, -1, true);
            } else if (footerIcon) {
                const Type = footerIcon.getAttribute("type");
                this.collectAndShow(Type);
            } else {
                const Type = headerIcon.getAttribute("type");
                if (Type === "close") {
                    this.hide();
                } else if (Type === "eye") {
                    this.toggleEye(headerIcon);
                    this.refresh();
                }
            }
        })
    }

    update = () => this.utils.isShow(this.entities.modal) && this.refresh()

    collectAndShow = Type => {
        this.setFooterActive(Type);
        this.collectUtil.collect();
        this.collectUtil.bindDOM(Type);
        this.utils.show(this.entities.modal);
    }

    setFooterActive = Type => {
        for (let ele = this.entities.footer.firstElementChild; !!ele; ele = ele.nextElementSibling) {
            const force = ele.getAttribute("type") === Type;
            ele.classList.toggle("select", force);
        }
    }

    refresh = () => {
        if (this.utils.isShow(this.entities.modal)) {
            const search = this.entities.footer.querySelector(".plugin-outline-icon.select");
            this.collectAndShow(search.getAttribute("Type"));
        }
    }

    toggleEye = icon => {
        this.config.SHOW_HIDDEN = !this.config.SHOW_HIDDEN;
        const eye = icon.classList.contains("ion-eye");
        const hint = (eye ? "不" : "") + "显示被其他插件隐藏的元素";
        icon.setAttribute("ty-hint", hint);
        icon.classList.toggle("ion-eye");
        icon.classList.toggle("ion-eye-disabled");
    }

    call = () => {
        if (this.utils.isShow(this.entities.modal)) {
            this.hide();
        } else {
            this.collectAndShow(this.config.DEFAULT_TYPE);
        }
    };

    hide = () => this.utils.hide(this.entities.modal);
}

class collectUtil {
    constructor(plugin) {
        this.config = plugin.config;
        this.utils = plugin.utils;
        this.listElement = plugin.entities.list;
        this.collection = null;
    }

    collect() {
        const idxMap = { paragraph: 0, table: 0, image: 0, fence: 0, link: 0, math: 0 };
        this.collection = { table: [], image: [], fence: [], link: [], math: [], all: [] };

        const selector = ":scope>h1, :scope>h2, .md-table, .md-fences, .md-image, .md-link, .md-math-block, .md-inline-math-container";
        this.utils.entities.eWrite.querySelectorAll(selector).forEach(ele => {
            if (!this.config.SHOW_HIDDEN && ele.style.display === "none") return;

            const tagName = ele.tagName;
            if (tagName === "H1" || tagName === "H2") {
                idxMap.paragraph = tagName === "H1" ? 0 : idxMap.paragraph + 1;
                idxMap.table = idxMap.image = idxMap.fence = idxMap.link = idxMap.math = 0;
                return;
            }

            const type = ele.classList.contains("md-table") ? "table"
                : ele.classList.contains("md-fences") ? "fence"
                    : ele.classList.contains("md-image") ? "image"
                        : ele.classList.contains("md-link") ? "link"
                            : (ele.classList.contains("md-math-block") || ele.classList.contains("md-inline-math-container")) ? "math"
                                : null;

            if (type) {
                idxMap[type]++;
                const cid = ele.closest("[cid]").getAttribute("cid");
                const collection = { cid, type, paragraphIdx: idxMap.paragraph, idx: idxMap[type] };
                this.collection[type].push(collection);
                this.collection.all.push(collection);
            }
        });
    }

    // 简易数据单向绑定
    bindDOM(type) {
        const collection = this.collection[type];
        const listEl = this.listElement;

        if (collection.length === 0) {
            listEl.innerHTML = `<div class="plugin-outline-empty">Empty</div>`;
            return;
        }

        const first = listEl.firstElementChild;
        if (first && first.classList.contains("plugin-outline-empty")) {
            listEl.removeChild(first);
        }

        const diff = collection.length - listEl.childElementCount;
        if (diff > 0) {
            const fragment = `<div class="plugin-outline-item"><span></span></div>`.repeat(diff);
            listEl.appendChild(this.utils.createDocumentFragment(fragment));
        } else if (diff < 0) {
            for (let i = diff; i < 0; i++) {
                listEl.removeChild(listEl.firstElementChild);
            }
        }

        const { SET_COLOR_IN_ALL, SHOW_NAME } = this.config;
        let ele = listEl.firstElementChild;
        collection.forEach(item => {
            if (SET_COLOR_IN_ALL) {
                ele.setAttribute("item-type", type === "all" ? item.type : "");
            }
            const span = ele.firstElementChild;
            span.dataset.ref = item.cid;
            span.innerText = `${SHOW_NAME[item.type] || item.type} ${item.paragraphIdx}-${item.idx}`;
            ele = ele.nextElementSibling;
        })
    }
}

module.exports = {
    plugin: outlinePlugin
};
