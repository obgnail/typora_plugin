/* 为了提高性能，把逻辑移到CSS，所以此插件采用非常绿皮的实现思路，请注意生产安全
*  1. 使用伪类::before作为点击按钮
*  2. ::before使用left样式飘出父元素的BoundingClientRect
*  3. 当父元素检测到click时，检测鼠标位置，如果鼠标位置超出父元素的Rect，则判定伪类被点击
*/
class collapseListPlugin extends BasePlugin {
    beforeProcess = () => {
        this.className = "plugin-collapsed-list";
        this.selector = '#write [mdtype="list"]';
        const color = this.config.TRIANGLE_COLOR || "var(--meta-content-color)";
        this.triangelStyle = {left: -18, top: 0, height: 9, halfWidth: 7, color: color};
    }
    styleTemplate = () => true

    process = () => {
        this.recordCollapseState(false);
        document.querySelector("#write").addEventListener("click", ev => {
            const parent = ev.target.closest(this.selector);
            if (!parent) return;

            const {left, top} = parent.getBoundingClientRect();
            const l = left + this.triangelStyle.left;
            const t = top + this.triangelStyle.top;
            const height = this.triangelStyle.height;
            const width = 2 * this.triangelStyle.halfWidth;
            const {clientX, clientY} = ev;
            if (l - width <= clientX && clientX <= l + width && t - height <= clientY && clientY <= t + height) {
                ev.stopPropagation();
                ev.preventDefault();
                if (this.checkCollapse(parent)) {
                    this.cancelCollapse(parent);
                } else {
                    this.setCollapse(parent);
                }
            }
        })
    }

    checkCollapse = ele => ele.classList.contains(this.className);
    setCollapse = ele => ele.classList.add("plugin-collapsed-list");
    cancelCollapse = ele => ele.classList.remove(this.className);

    recordCollapseState = (needChange = true) => {
        const name = "recordCollapseList";
        if (needChange) {
            this.config.RECORD_COLLAPSE = !this.config.RECORD_COLLAPSE;
        }
        if (this.config.RECORD_COLLAPSE) {
            this.utils.registerStateRecorder(name, this.selector, this.checkCollapse, this.setCollapse)
        } else {
            this.utils.unregisterStateRecorder(name);
        }
    }

    rollback = start => {
        let cur = start;
        while (true) {
            cur = cur.closest(`.${this.className}`);
            if (!cur) return;
            this.cancelCollapse(cur);
            cur = cur.parentElement;
        }
    }

    dynamicCallArgsGenerator = () => {
        const arg_name = `${this.config.RECORD_COLLAPSE ? "不" : ""}记住列表折叠状态`;
        return [{arg_name: arg_name, arg_value: "record_collapse_state"}];
    }

    call = type => {
        if (type === "record_collapse_state") {
            this.recordCollapseState(true);
        }
    }
}

module.exports = {
    plugin: collapseListPlugin
};

