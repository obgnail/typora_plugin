(() => {
    const config = {
        // 剩余文本段
        REMAIN_LENGTH: 80,
    }

    const isInViewBox = el => {
        if (el.style.display) return false;
        const totalHeight = window.innerHeight || document.documentElement.clientHeight;
        const totalWidth = window.innerWidth || document.documentElement.clientWidth;
        const {top, right, bottom, left} = el.getBoundingClientRect();
        return (top >= 0 && left >= 0 && right <= totalWidth && bottom <= totalHeight);
    }

    const hideFront = () => {
        const write = document.getElementById("write");
        const length = write.children.length;
        if (length > config.REMAIN_LENGTH) {
            for (let i = 0; i <= length - config.REMAIN_LENGTH; i++) {
                write.children[i].style.display = "none";
            }
        }
    }

    const showAll = () => document.getElementById("write").children.forEach(el => el.style.display = "");

    const hideBaseView = () => {
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

        write.children.forEach((ele, idx) => ele.style.display = (idx < start || idx > end) ? "none" : "");
    }

    const Call = type => {
        if (type === "hide_front") {
            hideFront();
        } else if (type === "show_all") {
            showAll();
        } else if (type === "hide_base_view") {
            hideBaseView();
        }
    }

    const CallArgs = [
        {
            "arg_name": "隐藏最前面",
            "arg_value": "hide_front"
        },
        {
            "arg_name": "重新显示",
            "arg_value": "show_all"
        },
        {
            "arg_name": "根据当前可视范围显示",
            "arg_value": "hide_base_view"
        }
    ];

    module.exports = {Call, CallArgs, config};
    console.log("truncate_text.js had been injected");
})()
