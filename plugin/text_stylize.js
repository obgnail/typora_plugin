class textStylizePlugin extends global._basePlugin {
    styleTemplate = () => true

    htmlTemplate = () => {
        const trList = this.utils.chunk(this.config.COLORS, this.config.NUM_PER_LINE).map(colorList => ({
            ele: "tr", children: colorList.map(color => ({ele: "td", style: {backgroundColor: color}, color}))
        }))

        return [{
            id: "plugin-text-stylize", class_: "plugin-common-modal", style: {display: "none"},
            children: [{ele: "table", children: [{ele: "tbody", children: trList}]}]
        }]
    }

    hotkey = () => [
        {hotkey: this.config.SHOW_MODAL_HOTKEY, callback: this.call},
        {hotkey: this.config.SET_COLOR_HOTKEY, callback: this.setColor},
    ]

    process = () => {
        this.lastColor = this.config.COLORS[0];
        this.modal_ = document.querySelector("#plugin-text-stylize");

        if (this.config.ALLOW_DRAG) {
            this.utils.dragFixedModal(this.modal_, this.modal_);
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
        if (!File.isLocked
            && window.getSelection().rangeCount
            && "INPUT" !== document.activeElement.tagName
            && "TEXTAREA" !== document.activeElement.tagName
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