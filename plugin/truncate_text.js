class truncateTextPlugin extends BasePlugin {
    beforeProcess = () => {
        this.className = "plugin-truncate-text";
        this.staticActions = [
            { act_name: `只保留最后${this.config.REMAIN_LENGTH}段`, act_value: "hide_front", act_hotkey: this.config.HIDE_FRONT_HOTKEY },
            { act_name: "重新显示所有内容", act_value: "show_all", act_hotkey: this.config.SHOW_ALL_HOTKEY },
            { act_name: "根据当前可视范围显示", act_value: "hide_base_view", act_hotkey: this.config.HIDE_BASE_VIEW_HOTKEY }
        ];
    }

    hotkey = () => [
        { hotkey: this.config.HIDE_FRONT_HOTKEY, callback: () => this.call("hide_front") },
        { hotkey: this.config.SHOW_ALL_HOTKEY, callback: () => this.call("show_all") },
        { hotkey: this.config.HIDE_BASE_VIEW_HOTKEY, callback: () => this.call("hide_base_view") },
    ]

    callbackOtherPlugin = () => {
        this.utils.callPluginFunction("toc", "refresh");
    }

    hideFront = () => {
        const write = this.utils.entities.eWrite;
        const length = write.children.length;
        if (length > this.config.REMAIN_LENGTH) {
            for (let i = 0; i <= length - this.config.REMAIN_LENGTH; i++) {
                const ele = write.children[i];
                ele.classList.add(this.className);
                ele.style.display = "none";
            }
        }
    }

    showAll = () => {
        const write = this.utils.entities.eWrite;
        write.getElementsByClassName(this.className).forEach(el => el.classList.remove(this.className));
        write.children.forEach(el => el.style.display = "");
    };

    hideBaseView = () => {
        const write = this.utils.entities.eWrite;
        let start = 0, end = 0;
        write.children.forEach((ele, idx) => {
            if (this.utils.isInViewBox(ele)) {
                if (!start) start = idx;
                start = Math.min(start, idx);
                end = Math.max(end, idx);
            }
        });

        const halfLength = this.config.REMAIN_LENGTH / 2;
        start = Math.max(start - halfLength, 0);
        end = Math.min(end + halfLength, write.children.length);

        write.children.forEach((ele, idx) => {
            if (idx < start || idx > end) {
                ele.classList.add(this.className);
                ele.style.display = "none";
            } else {
                ele.classList.remove(this.className);
                ele.style.display = "";
            }
        });
    }

    rollback = () => {
        if (this.utils.entities.querySelectorInWrite(`:scope > .${this.className}`)) {
            this.showAll();
        }
    };

    call = action => {
        if (action === "hide_front") {
            this.hideFront()
        } else if (action === "show_all") {
            this.showAll()
        } else if (action === "hide_base_view") {
            this.hideBaseView()
        }
        this.callbackOtherPlugin()
    }
}

module.exports = {
    plugin: truncateTextPlugin
};