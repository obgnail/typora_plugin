class truncateTextPlugin extends BasePlugin {
    beforeProcess = () => {
        this.className = "plugin-truncate-text";
    }

    hotkey = () => [
        {hotkey: this.config.HIDE_FRONT_HOTKEY, callback: () => this.call("hide_front")},
        {hotkey: this.config.SHOW_ALL_HOTKEY, callback: () => this.call("show_all")},
        {hotkey: this.config.HIDE_BASE_VIEW_HOTKEY, callback: () => this.call("hide_base_view")},
    ]

    callbackOtherPlugin = () => {
        const outlinePlugin = this.utils.getPlugin("outline");
        outlinePlugin && outlinePlugin.refresh();
    }

    hideFront = () => {
        const write = document.getElementById("write");
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
        const write = document.getElementById("write");
        write.getElementsByClassName(this.className).forEach(el => el.classList.remove(this.className));
        write.children.forEach(el => el.style.display = "");
    };

    hideBaseView = () => {
        const write = document.getElementById("write");
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
        if (document.querySelector(`#write > .${this.className}`)) {
            this.showAll();
        }
    };

    // // 已废弃
    // rollback2 = start => {
    //     if (document.querySelector(`#write > .${this.className}`)) {
    //         let ele = start.closest("#write > [cid]");
    //         while (ele) {
    //             if (ele.classList.contains(this.className)) {
    //                 ele.classList.remove(this.className);
    //                 ele.style.display = "";
    //             }
    //             ele = ele.nextElementSibling;
    //         }
    //     }
    // }

    call = type => {
        if (type === "hide_front") {
            this.hideFront();
        } else if (type === "show_all") {
            this.showAll();
        } else if (type === "hide_base_view") {
            this.hideBaseView();
        }
        this.callbackOtherPlugin();
    }

    callArgs = [
        {arg_name: `只保留最后${this.config.REMAIN_LENGTH}段`, arg_value: "hide_front"},
        {arg_name: "重新显示所有内容", arg_value: "show_all"},
        {arg_name: "根据当前可视范围显示", arg_value: "hide_base_view"}
    ];
}

module.exports = {
    plugin: truncateTextPlugin
};