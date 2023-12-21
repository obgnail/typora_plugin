class textStylizePlugin extends BasePlugin {
    styleTemplate = () => true

    htmlTemplate = () => {
        const trList = this.utils.chunk(this.config.COLORS, this.config.NUM_PER_LINE).map(colorList => ({
            ele: "tr", children: colorList.map(color => ({ele: "td", style: {backgroundColor: color}, color}))
        }))
        const children = [{ele: "table", children: [{ele: "tbody", children: trList}]}];
        return [{id: "plugin-text-stylize", class_: "plugin-common-modal", style: {display: "none"}, children}]
    }

    hotkey = () => [
        {hotkey: this.config.SHOW_MODAL_HOTKEY, callback: this.call},
        {hotkey: this.config.SET_COLOR_HOTKEY, callback: this.setColor},
    ]

    process = () => {
        this.lastColor = this.config.COLORS[0];
        this.modal_ = document.querySelector("#plugin-text-stylize");

        if (this.config.ALLOW_DRAG) {
            this.utils.dragFixedModal(this.modal_, this.modal_, false);
        }
        this.modal_.addEventListener("mousedown", ev => {
            if (this.utils.metaKeyPressed(ev)) return;
            const td = ev.target.closest("td");
            if (!td) return;
            this.lastColor = td.getAttribute("color");
            this.toggleForegroundColor();
            ev.preventDefault();
            ev.stopPropagation();
        }, true)
    }

    call = () => this.modal_.style.display = (this.modal_.style.display === "block") ? "none" : "block";

    // 有四种用户选中情况，比如：123<span style="color:#FF0000;">abc</span>defg
    //   1. 什么都没选中
    //   2. 普通选中（efg）
    //   3. 选中了内部文字（abc）：需要修改outerText
    //   4. 选中了外部文字（<span style="color:#FF0000;">abc</span>）：需要修改innerText
    setStyle = ({setMap, toggleMap, deleteMap, replaceMap, moveBookmark = true}) => {
        const activeElement = document.activeElement.tagName;
        if (File.isLocked || "INPUT" === activeElement || "TEXTAREA" === activeElement || !window.getSelection().rangeCount) return

        const matcher = new RegExp(/^<span\s?(style="(?<styles>.*?)").?>(?<wrapper>.*?)<\/span>$/);
        const suffix = "</span>";

        const {range, node, bookmark} = this.utils.getRangy();
        const ele = File.editor.findElemById(node.cid);
        const line = ele.rawText();

        let innerText = line.substring(bookmark.start, bookmark.end);
        let outerText = innerText;
        let wrapType = "";
        let newBookmark = null;

        const innerSelected = () => {
            if (line.substring(bookmark.start, bookmark.end + suffix.length).endsWith(suffix)) {
                return line.substring(0, bookmark.start).match(/<span .*?>$/)
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
                start: bookmark.start - innerRegRet[0].length,
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
            if (setMap) {
                Object.assign(styleMap, setMap);
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
                const {range, bookmark: bk} = this.utils.getRangy();
                // inner
                if (wrapType === "inner") {
                    bk.start = newBookmark.start + prefix.length;
                    bk.end = bk.start + innerText.length;
                    // outer 和 普通选中
                } else if (wrapType === "outer" || (wrapType === "" && innerText !== "")) {
                    bk.start = bookmark.start + prefix.length;
                    bk.end = bk.start + innerText.length;
                    // 什么都没选中
                } else if (wrapType === "" && innerText === "") {
                    bk.start = prefix.length;
                    bk.end = prefix.length;
                }
                range.moveToBookmark(bk);
                range.select();
            }, 100)
        }
    }

    toggleForegroundColor = color => this.setStyle({toggleMap: {color: color || this.lastColor}});
    toggleBackgroundColor = color => this.setStyle({toggleMap: {background: color || this.lastColor}});
    toggleFontSize = fontSize => this.setStyle({toggleMap: {"font-size": fontSize}});
    toggleFontWeight = fontWeight => this.setStyle({toggleMap: {"font-weight": fontWeight || "bold"}});
    toggleItalic = () => this.setStyle({toggleMap: {"font-style": "italic"}});
    toggleUnderline = () => this.setStyle({toggleMap: {"text-decoration": "underline"}});

    clearForegroundColor = () => this.setStyle({deleteMap: {color: null}});
    clearBackgroundColor = () => this.setStyle({deleteMap: {background: null}});
    clearFontSize = () => this.setStyle({deleteMap: {"font-size": null}});
    clearFontWeight = () => this.setStyle({deleteMap: {"font-weight": null}});
    clearItalic = () => this.setStyle({deleteMap: {"font-style": null}});
    clearUnderline = () => this.setStyle({deleteMap: {"text-decoration": null}});
    clearAll = () => this.setStyle({replaceMap: {}});

    replaceStyle = replaceMap => this.setStyle({replaceMap});
}

module.exports = {
    plugin: textStylizePlugin
};