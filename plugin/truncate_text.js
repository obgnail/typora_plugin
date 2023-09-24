class truncateTextPlugin extends global._basePlugin {
    callbackOtherPlugin = () => {
        const outlinePlugin = this.utils.getPlugin("outline");
        outlinePlugin && outlinePlugin.refresh();
    }

    isInViewBox = el => {
        if (el.style.display) return false;
        const totalHeight = window.innerHeight || document.documentElement.clientHeight;
        const totalWidth = window.innerWidth || document.documentElement.clientWidth;
        const {top, right, bottom, left} = el.getBoundingClientRect();
        return (top >= 0 && left >= 0 && right <= totalWidth && bottom <= totalHeight);
    }

    hideFront = () => {
        const write = document.getElementById("write");
        const length = write.children.length;
        if (length > this.config.REMAIN_LENGTH) {
            for (let i = 0; i <= length - this.config.REMAIN_LENGTH; i++) {
                const ele = write.children[i];
                ele.classList.add(this.config.CLASS_NAME);
                ele.style.display = "none";
            }
        }
    }

    showAll = () => {
        const write = document.getElementById("write");
        write.getElementsByClassName(this.config.CLASS_NAME).forEach(el => el.classList.remove(this.config.CLASS_NAME));
        write.children.forEach(el => el.style.display = "");
    };

    hideBaseView = () => {
        const write = document.getElementById("write");
        let start = 0, end = 0;
        write.children.forEach((ele, idx) => {
            if (this.isInViewBox(ele)) {
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
                ele.classList.add(this.config.CLASS_NAME);
                ele.style.display = "none";
            } else {
                ele.classList.remove(this.config.CLASS_NAME);
                ele.style.display = "";
            }
        });
    }

    rollback = () => {
        if (document.querySelector(`#write > .${this.config.CLASS_NAME}`)) {
            this.showAll();
        }
    };

    // // 已废弃
    // rollback2 = start => {
    //     if (document.querySelector(`#write > .${this.config.CLASS_NAME}`)) {
    //         let ele = start.closest("#write > [cid]");
    //         while (ele) {
    //             if (ele.classList.contains(this.config.CLASS_NAME)) {
    //                 ele.classList.remove(this.config.CLASS_NAME);
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