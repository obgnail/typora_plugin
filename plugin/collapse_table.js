class CollapseTablePlugin extends BasePlugin {
    styleTemplate = () => true

    init = () => {
        this.className = "plugin-collapse-table";
    }

    process = () => {
        this.utils.settings.autoSaveSettings(this)
        this.recordCollapseState(false);

        this.utils.decorate(() => File?.editor?.tableEdit, "showTableEdit", null, (result, $figure) => {
            if (!$figure || $figure.length === 0) return
            const $edit = $figure.find?.(".md-table-edit")
            if (!$edit || $edit.length === 0) return

            const iconClass = $figure.hasClass(this.className) ? "fa fa-plus" : "fa fa-minus"
            const btn = `<button type="button" class="btn btn-default plugin-collapse-table-btn" ty-hint="${this.pluginName}"><span class="${iconClass}"></span></button>`
            const $span = $(`<span class="md-th-button right-th-button">${btn}</span>`)
            $edit.append($span)
        })

        this.utils.entities.eWrite.addEventListener("click", ev => {
            const figure = ev.target.closest(".plugin-collapse-table-btn")?.closest("figure")
            if (figure) this.toggleTable(figure)
        })
    }

    call = (action, meta) => {
        if (action === "convert_current") {
            this.toggleTable(meta.target);
        } else if (action === "record_collapse_state") {
            this.recordCollapseState(true);
        }
    }

    getDynamicActions = (anchorNode, meta) => {
        const figure = anchorNode.closest("#write .table-figure")
        const act_hint = !figure ? this.i18n.t("actHint.convert_current") : ""
        meta.target = figure
        return this.i18n.fillActions([
            { act_value: "convert_current", act_hint, act_disabled: !figure },
            { act_value: "record_collapse_state", act_state: this.config.RECORD_COLLAPSE, act_name: this.i18n.t("$label.RECORD_COLLAPSE") }
        ])
    }

    toggleTable = figure => {
        const table = figure.querySelector("table");
        if (!table) return;
        figure.classList.toggle(this.className);
        const btn = figure.querySelector(".plugin-collapse-table-btn span")
        if (btn) {
            btn.classList.toggle("fa-plus")
            btn.classList.toggle("fa-minus")
        }
    }

    rollback = start => {
        let cur = start;
        while (cur && (cur = cur.closest(`.${this.className}`))) {
            this.toggleTable(cur);
            cur = cur.parentElement;
        }
    }

    checkCollapse = figure => figure.classList.contains(this.className);

    recordCollapseState = (needChange = true) => {
        if (needChange) {
            this.config.RECORD_COLLAPSE = !this.config.RECORD_COLLAPSE
        }
        if (this.config.RECORD_COLLAPSE) {
            this.utils.stateRecorder.register({
                name: this.fixedName,
                selector: "#write .table-figure",
                stateGetter: this.checkCollapse,
                stateRestorer: this.toggleTable,
            })
        } else {
            this.utils.stateRecorder.unregister(this.fixedName)
        }
    }
}

module.exports = {
    plugin: CollapseTablePlugin
}
