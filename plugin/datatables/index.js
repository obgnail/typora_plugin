class DataTablesPlugin extends BasePlugin {
    init = () => {
        this.dataTablesConfig = null;
        this.tableList = [];
    }

    process = () => {
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.otherFileOpened, this.destroyAllDataTable);
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.beforeToggleSourceMode, this.destroyAllDataTable);

        this.utils.decorate(() => File?.editor?.tableEdit, "showTableEdit", (...args) => {
            if (!args[0] || !args[0].find) return;

            const table = args[0].find("table");
            if (table.length === 0) return

            const uuid = table.attr("table-uuid");
            const idx = this.tableList.findIndex(table => table.uuid === uuid);
            if (idx !== -1) {
                return this.utils.stopCallError
            }
        })
    }

    destroyAllDataTable = () => {
        while (this.tableList.length) {
            this.removeDataTable(this.tableList[0].uuid);
        }
        this.tableList = [];
    }

    // addTfoot = $table => {
    //     const th = $table.find("thead th");
    //     const list = [...th].map(ele => `<td>${ele.textContent}: </td>`);
    //     const tfoot = `<tfoot><tr>${list.join("")}</tr></tfoot>`;
    //     $table.append(tfoot);
    // }

    appendFilter = dataTable => {
        dataTable.columns().flatten().each(function (colIdx) {
            const select = $("<select />").appendTo(dataTable.column(colIdx).header()).on("change", function () {
                dataTable.column(colIdx).search($(this).val()).draw();
            }).on("click", function () {
                return false
            })
            select.append($(`<option value=""></option>>`));
            dataTable.column(colIdx).cache("search").sort().unique().each(d => select.append($(`<option value="${d}">${d}</option>>`)))
        })
    }

    lazyLoad = async () => {
        if (!$?.fn?.dataTable) {
            this.initDataTablesConfig();
            await this.utils.insertScript("./plugin/datatables/resource/datatables.min.js");
            this.utils.insertStyleFile("plugin-datatables-common-style", "./plugin/datatables/resource/datatables.min.css");
            await this.utils.styleTemplater.register(this.fixedName);
        }
    }

    initDataTablesConfig = () => {
        this.dataTablesConfig = {
            paging: this.config.PAGING,
            ordering: this.config.ORDERING,
            searching: this.config.SEARCHING,
            pageLength: this.config.PAGE_LENGTH,
            scrollCollapse: this.config.SCROLL_COLLAPSE,
            processing: true,
            search: { caseInsensitive: this.config.CASE_INSENSITIVE, regex: this.config.REGEX },
            language: {
                processing: this.i18n.t("tableConfig.processing"),
                lengthMenu: this.i18n.t("tableConfig.lengthMenu"),
                zeroRecords: this.i18n.t("tableConfig.zeroRecords"),
                info: this.i18n.t("tableConfig.info"),
                infoEmpty: this.i18n.t("tableConfig.infoEmpty"),
                infoFiltered: this.i18n.t("tableConfig.infoFiltered"),
                search: this.i18n.t("tableConfig.search"),
                emptyTable: this.i18n.t("tableConfig.emptyTable"),
                loadingRecords: this.i18n.t("tableConfig.loadingRecords"),
                infoPostFix: "",
                searchPlaceholder: "",
                url: "",
                infoThousands: ",",
                thousands: ".",
                paginate: { first: "<<", previous: "<", next: ">", last: ">>" },
            }
        }
        if (!this.config.DEFAULT_ORDER) {
            this.dataTablesConfig.order = []
        }
    }

    newDataTable = async target => {
        if (!target) return;
        await this.lazyLoad();
        const edit = target.parentElement.querySelector(".md-table-edit");
        const $table = $(target);
        const uuid = this.utils.randomString();
        $table.attr("table-uuid", uuid);
        // addTfoot($table);
        const table = $table.dataTable(this.dataTablesConfig);
        this.appendFilter(table.api());
        this.tableList.push({ uuid, table });
        if (edit) edit.parentNode.removeChild(edit)
        return uuid
    }

    removeDataTable = uuid => {
        if (!uuid || !this.tableList.length) return;
        const idx = this.tableList.findIndex(table => table.uuid === uuid);
        if (idx === -1) return;

        const table = this.tableList[idx].table;
        const target = table[0];
        table.api().destroy();
        target.removeAttribute("table-uuid");
        this.tableList.splice(idx, 1);
        target.querySelectorAll("th select").forEach(ele => ele.parentNode.removeChild(ele));
        if (target) {
            const $fig = $(target.parentElement);
            File.editor.tableEdit.showTableEdit($fig);
        }
    }

    getDynamicActions = (anchorNode, meta) => {
        const table = anchorNode.closest("#write table.md-table");
        const uuid = table && table.getAttribute("table-uuid");
        meta.uuid = uuid;
        meta.target = table;

        const hint = this.i18n.t("actHint.positioningTable")
        const act_name = this.i18n.t(uuid ? "act.revert_table" : "act.enhance_table")
        const act = {
            act_name,
            act_value: uuid ? "revert_table" : "enhance_table",
            act_hint: !table ? hint : "",
            act_disabled: !table,
        }
        return [act]
    }

    call = async (action, meta) => {
        if (action === "enhance_table") {
            await this.newDataTable(meta.target)
        } else if (action === "revert_table") {
            this.removeDataTable(meta.uuid)
        }
    }
}

module.exports = {
    plugin: DataTablesPlugin
}
