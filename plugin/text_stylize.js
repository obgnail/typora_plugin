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
            this.setColor();
            ev.preventDefault();
            ev.stopPropagation();
        }, true)
    }

    call = () => this.modal_.style.display = (this.modal_.style.display === "block") ? "none" : "block";

    setColor = () => {
        const activeElement = document.activeElement.tagName;
        if (!File.isLocked
            && "INPUT" !== activeElement
            && "TEXTAREA" !== activeElement
            && window.getSelection().rangeCount
        ) {
            const rawText = this.utils.getRangyText();
            const content = `<font color="${this.lastColor}">${rawText}</font>`;
            this.utils.insertText(null, content, false);
        }
    }
}

module.exports = {
    plugin: textStylizePlugin
};