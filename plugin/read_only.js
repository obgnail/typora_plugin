(() => {
    const config = {
        // 进入和脱离只读模式的快捷键
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
    };

    (() => {
        const css = `#footer-word-count-label::before {content: attr(data-value) !important}`;
        const style = document.createElement('style');
        style.id = "plugin-read-only-style";
        style.type = 'text/css';
        style.innerHTML = css;
        document.getElementsByTagName("head")[0].appendChild(style);
    })()

    const metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey;

    const isExclude = ev => {
        for (const func of config.EXCLUDE_KEY) {
            if (func(ev)) {
                return true
            }
        }
        return false
    }

    const stopMouse = ev => {
        if (!File.isLocked) return;

        const target = ev.target.closest('.footnotes, figure[mdtype="table"], .md-task-list-item, .md-image, .ty-cm-lang-input, input[type="checkbox"]');
        // const target = ev.target.closest('.md-image');
        if (target) {
            ev.preventDefault();
            ev.stopPropagation();
        }
    }

    let lastClickTime = 0;
    const stopKeyboard = ev => {
        if (!File.isLocked) return;

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

    const write = document.getElementById("write");
    window.addEventListener("keydown", ev => config.HOTKEY(ev) && call(), true);
    write.addEventListener("keydown", stopKeyboard, true);
    write.addEventListener("mousedown", stopMouse, true);
    write.addEventListener("click", stopMouse, true);

    if (config.READ_ONLY_DEFAULT) {
        const _timer = setInterval(() => {
            if (File) {
                clearInterval(_timer);
                call();
            }
        }, config.LOOP_DETECT_INTERVAL);
    }

    const _timer2 = setInterval(() => {
        if (File) {
            clearInterval(_timer2);
            const decorator = (original, after) => {
                return function () {
                    const result = original.apply(this, arguments);
                    after.call(this, result, ...arguments);
                    return result;
                };
            }
            File.freshLock = decorator(File.freshLock, () => {
                if (!File.isLocked) return;
                ["typora-search-multi-input", "typora-commander-form", "plugin-multi-highlighter-input"].forEach(id => {
                    const input = document.querySelector(`#${id} input`);
                    input && input.removeAttribute("readonly");
                })
            });
        }
    }, config.LOOP_DETECT_INTERVAL);

    const call = () => {
        const span = document.getElementById("footer-word-count-label");
        if (File.isLocked) {
            File.unlock();
            span.setAttribute("data-value", "");
        } else {
            File.lock();
            document.activeElement.blur();
            span.setAttribute("data-value", "ReadOnly" + String.fromCharCode(160).repeat(3));
        }
    }

    module.exports = {
        config,
        call,
    };

    console.log("read_only.js had been injected");
})()