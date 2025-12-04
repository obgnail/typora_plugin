/** To improve performance, the logic is moved to CSS, so this plugin uses a very hacky implementation approach.
 *  1. Use the pseudo-class ::before as the click button
 *  2. ::before uses the left style to float out of the parent element's BoundingClientRect
 *  3. When the parent element detects a click, check the mouse position. If the mouse position is outside the parent element's Rect, then determine that the pseudo-class has been clicked
 */
class CollapseListPlugin extends BasePlugin {
    beforeProcess = () => {
        this.className = "plugin-collapsed-list";
        this.selector = '#write [mdtype="list"]';
        const color = this.config.TRIANGLE_COLOR || "var(--meta-content-color)";
        this.triangleStyle = { left: -18, top: 0, height: 9, halfWidth: 7, color: color };
    }

    styleTemplate = () => true

    process = () => {
        this.utils.settings.autoSaveSettings(this)
        this.recordCollapseState(false);
        this.utils.entities.eWrite.addEventListener("click", ev => {
            const parent = ev.target.closest(this.selector);
            if (!parent) return;

            const { clientX, clientY } = ev;
            const { left: PLeft, top: PTop } = parent.getBoundingClientRect();
            const { left: TLeft, top: TTop, height: THeight, halfWidth: THalfWidth } = this.triangleStyle;

            const left = PLeft + TLeft;
            const top = PTop + TTop;
            const height = THeight;
            const width = 2 * THalfWidth;
            if (
                left - width <= clientX
                && clientX <= left + width
                && top - height <= clientY
                && clientY <= top + height
            ) {
                ev.stopPropagation();
                ev.preventDefault();
                this.toggleCollapse(parent);
            }
        })
    }

    checkCollapse = ele => ele.classList.contains(this.className);
    setCollapse = ele => ele.classList.add(this.className);
    cancelCollapse = ele => ele.classList.remove(this.className);
    toggleCollapse = ele => ele.classList.toggle(this.className);

    recordCollapseState = (needChange = true) => {
        const name = "recordCollapseList";
        if (needChange) {
            this.config.RECORD_COLLAPSE = !this.config.RECORD_COLLAPSE;
        }
        if (this.config.RECORD_COLLAPSE) {
            this.utils.stateRecorder.register(name, this.selector, this.checkCollapse, this.setCollapse)
        } else {
            this.utils.stateRecorder.unregister(name);
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

    getDynamicActions = () => [{ act_value: "record_collapse_state", act_state: this.config.RECORD_COLLAPSE, act_name: this.i18n.t("$label.RECORD_COLLAPSE") }]

    call = action => {
        if (action === "record_collapse_state") {
            this.recordCollapseState(true);
        }
    }
}

module.exports = {
    plugin: CollapseListPlugin
}
