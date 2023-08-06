(() => {
    const config = {
        // 剩余文本段
        REMAIN_LENGTH: 80,

        IN_USE: false,
        CLASS_NAME: "plugin-truncate-text",
    }

    const isInViewBox = el => {
        if (el.style.display) return false;
        const totalHeight = window.innerHeight || document.documentElement.clientHeight;
        const totalWidth = window.innerWidth || document.documentElement.clientWidth;
        const {top, right, bottom, left} = el.getBoundingClientRect();
        return (top >= 0 && left >= 0 && right <= totalWidth && bottom <= totalHeight);
    }

    const hideFront = () => {
        config.IN_USE = true;
        const write = document.getElementById("write");
        const length = write.children.length;
        if (length > config.REMAIN_LENGTH) {
            for (let i = 0; i <= length - config.REMAIN_LENGTH; i++) {
                const ele = write.children[i];
                ele.classList.add(config.CLASS_NAME);
                ele.style.display = "none";
            }
        }
    }

    const showAll = () => {
        config.IN_USE = false;
        const write = document.getElementById("write");
        write.getElementsByClassName(config.CLASS_NAME).forEach(el => el.classList.remove(config.CLASS_NAME));
        write.children.forEach(el => el.style.display = "");
    };

    const hideBaseView = () => {
        config.IN_USE = true;
        const write = document.getElementById("write");
        let start = 0, end = 0;
        write.children.forEach((ele, idx) => {
            if (isInViewBox(ele)) {
                if (!start) start = idx;
                start = Math.min(start, idx);
                end = Math.max(end, idx);
            }
        });

        const halfLength = config.REMAIN_LENGTH / 2;
        start = Math.max(start - halfLength, 0);
        end = Math.min(end + halfLength, write.children.length);

        write.children.forEach((ele, idx) => {
            if (idx < start || idx > end) {
                ele.classList.add(config.CLASS_NAME);
                ele.style.display = "none";
            } else {
                ele.classList.remove(config.CLASS_NAME);
                ele.style.display = "";
            }
        });
    }

    const rollback = start => {
        if (!config.IN_USE) return;

        let ele = start.closest("#write [cid]");
        while (ele) {
            if (ele.classList.contains(config.CLASS_NAME)) {
                ele.classList.remove(config.CLASS_NAME);
                ele.style.display = "";
            }
            ele = ele.nextElementSibling;
        }
    }

    const call = type => {
        if (type === "hide_front") {
            hideFront();
        } else if (type === "show_all") {
            showAll();
        } else if (type === "hide_base_view") {
            hideBaseView();
        }
    }

    const callArgs = [
        {
            arg_name: `只保留最后${config.REMAIN_LENGTH}段`,
            arg_value: "hide_front"
        },
        {
            arg_name: "重新显示所有内容",
            arg_value: "show_all"
        },
        {
            arg_name: "根据当前可视范围显示",
            arg_value: "hide_base_view"
        }
    ];

    module.exports = {
        config,
        call,
        callArgs,
        meta: {
            rollback,
        }
    };
    console.log("truncate_text.js had been injected");
})()
