(() => {
    const config = {
        // 启用脚本,若为false,以下配置全部失效
        ENABLE: true,
        // 进入和脱离只读模式的快捷键。如果修改快捷键，请修改config.READ_ONLY_DEFAULT处的代码
        HOTKEY: ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "R",
        // 默认使用只读模式
        READ_ONLY_DEFAULT: false,
        // 只读模式下仍可以使用的快捷键
        EXCLUDE_KEY: [
            // 文件
            ev => metaKeyPressed(ev) && ev.key === "n", // 新建
            ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "N", // 新建窗口
            ev => metaKeyPressed(ev) && ev.key === "o", // 打开
            ev => metaKeyPressed(ev) && ev.key === "p", // 快速打开
            ev => metaKeyPressed(ev) && ev.key === "s", // 保存
            ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "S", // 另存
            ev => metaKeyPressed(ev) && ev.key === ",", // 偏好设置
            ev => metaKeyPressed(ev) && ev.key === "w", // 关闭

            // 编辑
            ev => metaKeyPressed(ev) && ev.key === "c", // 复制
            ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "C", // 复制为markdown
            ev => metaKeyPressed(ev) && ev.key === "a", // 全选
            ev => metaKeyPressed(ev) && ev.key === "l", // 选中当前行
            ev => metaKeyPressed(ev) && ev.key === "e", // 选中当前格式文本
            ev => metaKeyPressed(ev) && ev.key === "d", // 选中当前词
            ev => metaKeyPressed(ev) && ev.key === "j", // 跳转到所选内容
            ev => metaKeyPressed(ev) && ev.key === "Home", // 跳转到文首
            ev => metaKeyPressed(ev) && ev.key === "End", // 跳转到文末
            ev => metaKeyPressed(ev) && ev.key === "f", // 查找
            ev => ev.key === "F3", // 查找下一个
            ev => ev.shiftKey && ev.key === "F3", // 查找上一个

            // 视图
            ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "L", // 显示/隐藏侧边栏
            ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "!", // 大纲
            ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "@", // 文档列表
            ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "#", // 文档树
            ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "F", // 搜索
            ev => metaKeyPressed(ev) && ev.key === "/", // 源码模式
            ev => ev.key === "F8", // 专注模式
            ev => ev.key === "F9", // 打字机模式
            ev => ev.key === "F11", // 全屏
            ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "(",  // 实际大小
            ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "+",  // 放大
            ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "_",  // 缩小
            ev => metaKeyPressed(ev) && ev.key === "Tab", // 应用内窗口切换
            ev => ev.shiftKey && ev.key === "F12", // 开发者工具

            // 整个应用
            ev => ev.altKey && ev.key === "F4", // 退出
        ],

        // 脚本内部使用
        LOOP_DETECT_INTERVAL: 30,
        CLICK_CHECK_INTERVAL: 500,
        FIRST_ENTER_MODE: true,
    };

    if (!config.ENABLE) {
        return
    }

    const showNotification = () => {
        if (!config.FIRST_ENTER_MODE) {
            return
        }

        const notification = document.getElementById("md-notification");
        let div = `
            <p class="ty-enter-mode-warning-header"><strong>Read Only Mode</strong> 已开启。</p>
            <p data-lg="Front" style="opacity: 0.7;font-size: 0.8rem;margin-top: -4px;">键入快捷键 Ctrl+Shift+R 关闭</p>
            <p style="float: right;position: absolute;right: 32px;bottom: -2px;padding:0;background: inherit;">
                <button id="ty-surpress-mode-warning-close-btn" class="btn btn-default btn-sm ty-read-only-close-btn" style="float:right;margin-right: -18px;margin-top:1px;" data-localize="Dismiss" data-lg="Front">关闭</button>
            </p>
        `
        notification.style.zIndex = "902";
        notification.insertAdjacentHTML('beforeend', div);
        document.querySelector(".ty-read-only-close-btn").addEventListener("click", ev => notification.style.display = "none");
        if (notification.style.display !== "block") {
            notification.style.display = "block";
        }
        config.FIRST_ENTER_MODE = false;
    }

    const hideNotification = () => {
        if (document.getElementById("md-notification").style.display !== "none") {
            document.querySelector(".ty-read-only-close-btn").click();
        }
    }

    const metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey;

    const isExclude = ev => {
        for (const func of config.EXCLUDE_KEY) {
            if (func(ev)) {
                return true
            }
        }
        return false
    }

    let lastClickTime = 0;
    window.addEventListener("keydown", ev => {
        if (config.HOTKEY(ev)) {
            showNotification();
            if (File.isLocked) {
                File.unlock();
                hideNotification();
            } else {
                File.lock();
            }
        }

        if (File.isLocked) {
            // 无奈之举
            if (ev.timeStamp - lastClickTime > config.CLICK_CHECK_INTERVAL) {
                File.lock();
            }

            // File.isLocked 也挡不住回车键 :(
            // 为什么要使用isExclude排除按键？因为输入法激活状态下键入能突破 File.isLocked
            if ((ev.key === "Enter") || !isExclude(ev)) {
                document.activeElement.blur();
                ev.preventDefault();
                ev.stopPropagation();
            }
        }
    }, true)

    document.getElementById("write").addEventListener("mousedown", ev => {
        if (!File.isLocked) {
            return
        }
        // const target = ev.target.closest('.footnotes, [mdtype="table"], .md-task-list-item, .md-image, .ty-cm-lang-input');
        const target = ev.target.closest('.md-image');
        if (target) {
            ev.preventDefault();
            ev.stopPropagation();
        }
    }, true)

    if (config.READ_ONLY_DEFAULT) {
        const _timer = setInterval(() => {
            if (File) {
                clearInterval(_timer);
                window.dispatchEvent(new KeyboardEvent("keydown", {
                    key: "R", code: "R", ctrlKey: true, metaKey: true, shiftKey: true,
                }))
            }
        }, config.LOOP_DETECT_INTERVAL);
    }

    console.log("read_only.js had been injected");
})()