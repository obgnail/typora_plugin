class textStylizePlugin extends BasePlugin {
    styleTemplate = () => true

    htmlTemplate = () => {
        const children = [{class_: "stylize-tool", children: this.genToolbarHTML()}, this.genTableHTML()];
        return [{id: "plugin-text-stylize", class_: "plugin-common-modal", style: {display: "none"}, children}]
    }

    hotkey = () => [{hotkey: this.config.SHOW_MODAL_HOTKEY, callback: this.call}]

    init = () => {
        this.entities = {
            modal: document.querySelector("#plugin-text-stylize"),
            toolbar: document.querySelector("#plugin-text-stylize .stylize-tool"),
            palette: document.querySelector("#plugin-text-stylize .stylize-palette"),
        }
    }

    process = () => {
        this.init();

        this.utils.dragFixedModal(this.entities.toolbar.querySelector(`[action="move"]`), this.entities.modal, false);

        const selector = `#plugin-text-stylize [action="fore"], #plugin-text-stylize [action="back"], #plugin-text-stylize [action="border"]`;
        $(selector).on("mouseenter", function () {
            document.querySelectorAll(selector).forEach(ele => ele.classList.remove("select"));
            this.classList.add("select");
        })

        this.entities.toolbar.addEventListener("mousedown", ev => {
            const target = ev.target.closest("[action]");
            if (!target) return;
            const action = target.getAttribute("action");
            if (action === "move") return;

            const color = target.getAttribute("last-color") || "black";
            this.onAction(action, color);
            ev.preventDefault();
            ev.stopPropagation();
        }, true)

        this.entities.palette.addEventListener("mousedown", ev => {
            const td = ev.target.closest("td");
            if (!td) return;
            const color = td.getAttribute("color");
            const target = this.entities.toolbar.querySelector(":scope > .select");
            target.querySelector("svg path").setAttribute("fill", color);
            target.setAttribute("last-color", color);
            const action = target.getAttribute("action")
            this.onAction(action, color);
            ev.preventDefault();
            ev.stopPropagation();
        }, true)
    }

    call = () => this.entities.modal.style.display = (this.entities.modal.style.display === "block") ? "none" : "block";

    genToolbarHTML = () => {
        const eleMap = {
            blank: ``,
            weight: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M272-200v-560h221q65 0 120 40t55 111q0 51-23 78.5T602-491q25 11 55.5 41t30.5 90q0 89-65 124.5T501-200H272Zm121-112h104q48 0 58.5-24.5T566-372q0-11-10.5-35.5T494-432H393v120Zm0-228h93q33 0 48-17t15-38q0-24-17-39t-44-15h-95v109Z"/></svg>`,
            italic: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M200-200v-100h160l120-360H320v-100h400v100H580L460-300h140v100H200Z"/></svg>`,
            underline: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M200-120v-80h560v80H200Zm280-160q-101 0-157-63t-56-167v-330h103v336q0 56 28 91t82 35q54 0 82-35t28-91v-336h103v330q0 104-56 167t-157 63Z"/></svg>`,
            size: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M560-160v-520H360v-120h520v120H680v520H560Zm-360 0v-320H80v-120h360v120H320v320H200Z"/></svg>`,
            family: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M186-80q-54 0-80-22t-26-66q0-58 49-74t116-16h21v-56q0-34-1-55.5t-6-35.5q-5-14-11.5-19.5T230-430q-9 0-16.5 3t-12.5 8q-4 5-5 10.5t1 11.5q6 11 14 21.5t8 24.5q0 25-17.5 42.5T159-291q-25 0-42.5-17.5T99-351q0-27 12-44t32.5-27q20.5-10 47.5-14t58-4q85 0 118 30.5T400-302v147q0 19 4.5 28t15.5 9q12 0 19.5-18t9.5-56h11q-3 62-23.5 87T368-80q-43 0-67.5-13.5T269-134q-10 29-29.5 41.5T186-80Zm373 0q-20 0-32.5-16.5T522-132l102-269q7-17 22-28t34-11q19 0 34 11t22 28l102 269q8 19-4.5 35.5T801-80q-12 0-22-7t-15-19l-20-58H616l-20 58q-4 11-14 18.5T559-80Zm-324-29q13 0 22-20.5t9-49.5v-67q-26 0-38 15.5T216-180v11q0 36 4 48t15 12Zm407-125h77l-39-114-38 114Zm-37-285q-48 0-76.5-33.5T500-643q0-104 66-170.5T735-880q42 0 68 9.5t26 24.5q0 6-2 12t-7 11q-5 7-12.5 10t-15.5 1q-14-4-32-7t-33-3q-71 0-114 48t-43 127q0 22 8 46t36 24q11 0 21.5-5t18.5-14q17-18 31.5-60T712-758q2-13 10.5-18.5T746-782q18 0 27.5 9.5T779-749q-12 43-17.5 75t-5.5 58q0 20 5.5 29t16.5 9q11 0 21.5-8t29.5-30q2-3 15-7 8 0 12 6t4 17q0 28-32 54t-67 26q-26 0-44.5-14T691-574q-15 26-37 40.5T605-519Zm-485-1v-220q0-58 41-99t99-41q58 0 99 41t41 99v220h-80v-80H200v80h-80Zm80-160h120v-60q0-25-17.5-42.5T260-800q-25 0-42.5 17.5T200-740v60Z"/></svg>`,
            fore: `<svg xmlns="http://www.w3.org/2000/svg" height="28" viewBox="0 -960 960 960" width="28"><path d="M200-200v-80h560v80H200Zm76-160 164-440h80l164 440h-76l-38-112H392l-40 112h-76Zm138-176h132l-64-182h-4l-64 182Z"/></svg>`,
            back: `<svg xmlns="http://www.w3.org/2000/svg" height="22" viewBox="0 -960 960 960" width="22"><path d="m247-904 57-56 343 343q23 23 23 57t-23 57L457-313q-23 23-57 23t-57-23L153-503q-23-23-23-57t23-57l190-191-96-96Zm153 153L209-560h382L400-751Zm360 471q-33 0-56.5-23.5T680-360q0-21 12.5-45t27.5-45q9-12 19-25t21-25q11 12 21 25t19 25q15 21 27.5 45t12.5 45q0 33-23.5 56.5T760-280ZM80 0v-160h800V0H80Z"/></svg>`,
            border: `<svg xmlns="http://www.w3.org/2000/svg" height="22" viewBox="0 -960 960 960" width="22"><path d="M80 0v-160h800V0H80Zm160-320h56l312-311-29-29-28-28-311 312v56Zm-80 80v-170l448-447q11-11 25.5-17t30.5-6q16 0 31 6t27 18l55 56q12 11 17.5 26t5.5 31q0 15-5.5 29.5T777-687L330-240H160Zm560-504-56-56 56 56ZM608-631l-29-29-28-28 57 57Z"/></svg>`,
            erase: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M690-240h190v80H610l80-80Zm-500 80-85-85q-23-23-23.5-57t22.5-58l440-456q23-24 56.5-24t56.5 23l199 199q23 23 23 57t-23 57L520-160H190Zm296-80 314-322-198-198-442 456 64 64h262Zm-6-240Z"/></svg>`,
            move: `<svg xmlns="http://www.w3.org/2000/svg" height="22" viewBox="0 -960 960 960" width="22"><path d="M480-80 310-250l57-57 73 73v-166h80v165l72-73 58 58L480-80ZM250-310 80-480l169-169 57 57-72 72h166v80H235l73 72-58 58Zm460 0-57-57 73-73H560v-80h165l-73-72 58-58 170 170-170 170ZM440-560v-166l-73 73-57-57 170-170 170 170-57 57-73-73v166h-80Z"/></svg>`,
            close: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>`,
        }
        return this.config.TOOLBAR.map(name => {
            if (!eleMap.hasOwnProperty(name)) return;
            const span = document.createElement("span");
            span.setAttribute("action", name);
            if (name === "fore") {
                span.classList.add("select");
            } else if (name === "blank") {
                span.style.visibility = "hidden";
            }
            span.innerHTML = eleMap[name];
            return span
        }).filter(Boolean)
    }

    genTableHTML = () => {
        const trList = this.utils.chunk(this.config.COLORS, this.config.NUM_PER_LINE).map(colorList => ({
            ele: "tr", children: colorList.map(color => ({ele: "td", style: {backgroundColor: color}, color}))
        }))
        return {ele: "table", class_: "stylize-palette", children: [{ele: "tbody", children: trList}]};
    }

    onAction = (action, color) => {
        const callMap = this.genCallMap(color);
        const func = callMap[action];
        func && func();
    }

    genCallMap = color => ({
        weight: this.toggleFontWeight,
        italic: this.toggleItalic,
        underline: this.toggleUnderline,
        erase: this.clearAll,
        close: this.call,
        size: () => this.toggleFontSize("2em"),
        family: () => this.toggleFontFamily("serif"),
        fore: () => this.toggleForegroundColor(color),
        back: () => this.toggleBackgroundColor(color),
        border: () => this.toggleBorder(`1px solid ${color}`),
    })

    // 有四种用户选中情况，比如：123<span style="color:#FF0000;">abc</span>defg
    //   1. 什么都没选中
    //   2. 普通选中（efg）
    //   3. 选中了内部文字（abc）：需要修改outerText
    //   4. 选中了外部文字（<span style="color:#FF0000;">abc</span>）：需要修改innerText
    // 其实业务代码只用到了toggleMap和replaceMap，upsertMap和deleteMap留作后续开发使用
    setStyle = ({upsertMap, toggleMap, deleteMap, replaceMap, moveBookmark = true}) => {
        const activeElement = document.activeElement.tagName;
        if (File.isLocked || "INPUT" === activeElement || "TEXTAREA" === activeElement || !window.getSelection().rangeCount) return

        const {range, node, bookmark} = this.utils.getRangy();
        if (!node) return;
        const ele = File.editor.findElemById(node.cid);
        const line = ele.rawText();

        const beforeText = line.substring(0, bookmark.start);
        let innerText = line.substring(bookmark.start, bookmark.end);
        let outerText = innerText;
        let wrapType = "";
        let newBookmark = null;

        const matcher = new RegExp(/^<span\s?(style="(?<styles>.*?)")?>(?<wrapper>.*?)<\/span>$/);
        const suffix = "</span>";

        const innerSelected = () => {
            if (line.substring(bookmark.start, bookmark.end + suffix.length).endsWith(suffix)) {
                const result = beforeText.match(/<span .*?>/g);
                if (!result) return;
                const last = result[result.length - 1];
                if (last && beforeText.endsWith(last)) {
                    return last
                }
            }
        }

        const outerSelected = () => {
            const result = innerText.match(matcher);
            return result && result.groups && result.groups.wrapper;
        }

        const innerRegRet = innerSelected();
        // 选中了内部文字
        if (innerRegRet) {
            wrapType = "inner";
            newBookmark = {
                containerNode: bookmark.containerNode,
                start: bookmark.start - innerRegRet.length,
                end: bookmark.end + suffix.length,
            }
            range.moveToBookmark(newBookmark);
            range.select();
            outerText = line.substring(newBookmark.start, newBookmark.end);
        } else {
            const outerRegRet = outerSelected()
            // 选中了外部文字
            if (outerRegRet) {
                wrapType = "outer";
                innerText = outerRegRet;
            }
        }

        let styleMap = {};
        if (typeof replaceMap !== "undefined") {
            styleMap = replaceMap;
        } else {
            const regexpResult = outerText.match(matcher);
            const styles = regexpResult && regexpResult.groups && regexpResult.groups.styles;
            if (styles) {
                styles.split(";").forEach(s => {
                    const [attr, value] = s.trim().split(":");
                    if (attr && value) {
                        styleMap[attr] = value;
                    }
                })
            }
            if (upsertMap) {
                Object.assign(styleMap, upsertMap);
            }
            if (toggleMap) {
                Object.entries(toggleMap).forEach(([key, value]) => {
                    if (styleMap[key] === value) {
                        delete styleMap[key];
                    } else {
                        styleMap[key] = value;
                    }
                })
            }
            if (deleteMap) {
                Object.keys(deleteMap).forEach(key => delete styleMap[key]);
            }
        }

        const style = Object.entries(styleMap).map(([key, value]) => `${key}:${value};`).join(" ");
        const prefix = (style === "") ? "" : `<span style="${style}">`;
        const content = (style === "") ? innerText : prefix + innerText + suffix;
        this.utils.insertText(null, content, false);

        if (moveBookmark) {
            setTimeout(() => {
                let start = 0;
                // inner
                if (wrapType === "inner") {
                    start = newBookmark.start;
                    // outer 和 普通选中
                } else if (wrapType === "outer" || (wrapType === "" && innerText !== "")) {
                    start = bookmark.start;
                    // 什么都没选中
                } else if (wrapType === "" && innerText === "") {
                    start = beforeText.length;
                }

                const {range, bookmark: bk} = this.utils.getRangy();
                bk.start = start + prefix.length;
                bk.end = bk.start + innerText.length;
                range.moveToBookmark(bk);
                range.select();
            }, 100)
        }
    }

    toggleForegroundColor = color => this.setStyle({toggleMap: {color: color}});
    toggleBackgroundColor = color => this.setStyle({toggleMap: {background: color}});
    toggleFontSize = size => this.setStyle({toggleMap: {"font-size": size}});
    toggleFontWeight = weight => this.setStyle({toggleMap: {"font-weight": weight || "bold"}});
    toggleFontFamily = family => this.setStyle({toggleMap: {"font-family": family}});
    toggleItalic = () => this.setStyle({toggleMap: {"font-style": "italic"}});
    toggleUnderline = () => this.setStyle({toggleMap: {"text-decoration": "underline"}});
    toggleBorder = border => this.setStyle({toggleMap: {border}});

    clearAll = () => this.setStyle({replaceMap: {}});
    replaceStyle = replaceMap => this.setStyle({replaceMap});

    // 下面的clear函数都没有投入使用，仅仅是为了展示deleteMap的用法。upsertMap的用法和toggleMap完全一致
    clearForegroundColor = () => this.setStyle({deleteMap: {color: null}});
    clearBackgroundColor = () => this.setStyle({deleteMap: {background: null}});
    clearFontSize = () => this.setStyle({deleteMap: {"font-size": null}});
    clearFontWeight = () => this.setStyle({deleteMap: {"font-weight": null}});
    clearFontFamily = () => this.setStyle({deleteMap: {"font-family": null}});
    clearItalic = () => this.setStyle({deleteMap: {"font-style": null}});
    clearUnderline = () => this.setStyle({deleteMap: {"text-decoration": null}});
    clearBorder = () => this.setStyle({deleteMap: {border: null}});
}

module.exports = {
    plugin: textStylizePlugin
};
