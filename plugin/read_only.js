(() => {
    const config = {
        // 进入和脱离只读模式的快捷键
        HOTKEY: ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "R",
        // 是否默认使用只读模式
        READ_ONLY_DEFAULT: true,
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
        ],

        // 脚本内部使用
        DEBUG: false,
        READ_ONLY: false,
    };

    if (config.READ_ONLY_DEFAULT) {
        config.READ_ONLY = true;
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

    window.addEventListener("keydown", ev => {
        if (!config.HOTKEY(ev)) {
            if (isExclude(ev)) {
                return
            }
            if (config.READ_ONLY) {
                // document.activeElement.blur();
                ev.preventDefault();
                ev.stopPropagation();
            }
        } else {
            config.READ_ONLY = !config.READ_ONLY;
        }
    }, true)


    if (config.DEBUG) {
        JSBridge.invoke("window.toggleDevTools");
    }

    console.log("read_only.js had been injected");
})()