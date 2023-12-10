class datatablesPlugin extends BasePlugin {
    init = () => {
        this.dataTablesConfig = null;
        this.tableList = [];
    }

    process = () => {
        this.init();

        this.utils.addEventListener(this.utils.eventType.otherFileOpened, this.destroyAllDataTable);
        this.utils.addEventListener(this.utils.eventType.beforeToggleSourceMode, this.destroyAllDataTable);

        this.utils.decorate(() => File && File.editor && File.editor.tableEdit, "showTableEdit", (...args) => {
                if (!args[0] || !args[0].find) return;

                const table = args[0].find("table");
                if (table.length === 0) return

                const uuid = table.attr("table-uuid");
                const idx = this.tableList.findIndex(table => table.uuid === uuid);
                if (idx !== -1) {
                    return this.utils.stopCallError
                }
            }
        )
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
        if (!($ && $.fn && $.fn.dataTable)) {
            this.initDataTablesConfig();
            await this.utils.insertScript("./plugin/datatables/resource/datatables.min.js");
            this.utils.insertStyleFile("plugin-datatables-common-style", "./plugin/datatables/resource/datatables.min.css");
            await this.utils.registerStyleTemplate(this.fixedName);
        }
    }

    initDataTablesConfig = () => {
        this.dataTablesConfig = {
            paging: this.config.PAGING,
            ordering: this.config.ORDERING,
            searching: this.config.SEARCHING,
            pageLength: this.config.PAGE_LENGTH,
            scrollCollapse: this.config.SROLL_COLLAPSE,
            processing: true,
            search: {caseInsensitive: this.config.CASE_INSENSITIVE, regex: this.config.REGEX},
            language: {
                processing: "处理中...",
                lengthMenu: "每页 _MENU_ 项",
                zeroRecords: "没有匹配结果",
                info: "_START_ ~ _END_ 项 (共 _TOTAL_ 项)",
                infoEmpty: "共 0 项",
                infoFiltered: "(由 _MAX_ 项结果过滤)",
                infoPostFix: "",
                search: "搜索:",
                searchPlaceholder: "",
                url: "",
                emptyTable: "表中数据为空",
                loadingRecords: "载入中...",
                infoThousands: ",",
                thousands: ".",
                paginate: {first: "<<", previous: "<", next: ">", last: ">>"},
            }
        };
        if (this.config.SCROLLY > 0) {
            this.dataTablesConfig = this.config.SCROLLY;
        }
        if (!this.config.DEFAULT_ORDER) {
            this.dataTablesConfig["order"] = [];
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
        this.tableList.push({uuid, table});
        edit && edit.parentNode.removeChild(edit);
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

    dynamicCallArgsGenerator = (anchorNode, meta) => {
        const table = anchorNode.closest("#write table.md-table");
        const uuid = table && table.getAttribute("table-uuid");
        meta.uuid = uuid;
        meta.target = table;

        return [{
            arg_name: (uuid) ? "转回普通表格" : "增强表格",
            arg_value: (uuid) ? "rollback_current" : "convert_current",
            arg_disabled: !table,
        }]
    }

    call = async (type, meta) => {
        if (type === "convert_current") {
            await this.newDataTable(meta.target);
        } else if (type === "rollback_current") {
            this.removeDataTable(meta.uuid);
        }
    }
}

module.exports = {
    plugin: datatablesPlugin,
};
