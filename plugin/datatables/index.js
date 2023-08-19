class datatablesPlugin extends global._basePlugin {
    style = () => {
        const textID = "plugin-datatables-custom-style";
        const text = `
            #write figure select,
            #write figure input {
                border: 1px solid #ddd;
                box-shadow: inset 0 1px 1px rgba(0, 0, 0, .075);
                border-radius: 2px;
                height: 27px;
                margin-top: 5px;
                margin-bottom: 1px;
                max-width: 10em;
            }

            .dataTables_wrapper .dataTables_paginate .paginate_button {
                padding: 0.05em 0.1em;
            }
            
            .dataTables_wrapper .dataTables_length, .dataTables_filter {
                margin-bottom: 0.25em;
            }
             
            .dataTables_wrapper .dataTables_info {
                padding-top: 0.25em;
            }`;

        const fileID = "plugin-datatables-common-style";
        const file = "./plugin/datatables/resource/datatables.min.css";
        return {textID, text, fileID, file}
    }

    html = () => {
        const jsFilepath = this.utils.joinPath("./plugin/datatables/resource/datatables.min.js");
        $.getScript(`file:///${jsFilepath}`).then(() => console.log("datatables.min.js has inserted"));
    }

    init = () => {
        this.dataTablesConfig = {
            paging: this.config.PAGING,
            ordering: this.config.ORDERING,
            searching: this.config.SEARCHING,
            pageLength: this.config.PAGE_LENGTH,
            scrollCollapse: this.config.SROLL_COLLAPSE,
            processing: true,
            search: {
                caseInsensitive: this.config.CASE_INSENSITIVE,
                regex: this.config.REGEX,
            },
            language: {
                "processing": "处理中...",
                "lengthMenu": "每页 _MENU_ 项",
                "zeroRecords": "没有匹配结果",
                "info": "_START_ ~ _END_ 项 (共 _TOTAL_ 项)",
                "infoEmpty": "共 0 项",
                "infoFiltered": "(由 _MAX_ 项结果过滤)",
                "infoPostFix": "",
                "search": "搜索:",
                "searchPlaceholder": "",
                "url": "",
                "emptyTable": "表中数据为空",
                "loadingRecords": "载入中...",
                "infoThousands": ",",
                "paginate": {
                    "first": "<<",
                    "previous": "<",
                    "next": ">",
                    "last": ">>"
                },
                "thousands": "."
            }
        };
        if (this.config.SCROLLY > 0) {
            this.dataTablesConfig = this.config.SCROLLY;
        }
        if (!this.config.DEFAULT_ORDER) {
            this.dataTablesConfig["order"] = [];
        }

        this.tableList = [];

        this.dynamicUtil = {target: null, uuid: ""}
    }

    process = () => {
        this.init();

        this.utils.decorateOpenFile(null, () => {
            this.tableList.forEach(table => table.table.api().destroy());
            this.tableList = [];
        })

        this.utils.decorate(
            () => (File && File.editor && File.editor.tableEdit && File.editor.tableEdit.showTableEdit),
            File.editor.tableEdit,
            "showTableEdit",
            (...args) => {
                if (!args[0]) return;
                const table = args[0].find("table");
                if (table.length === 0) return

                const uuid = table.attr("table-uuid");
                const idx = this.tableList.findIndex(table => table.uuid === uuid);
                if (idx !== -1) {
                    return this.utils.stopCallError
                }
            },
            null
        )
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

    newDataTable = target => {
        const edit = target.parentElement.querySelector(".md-table-edit");
        const $table = $(target);
        const uuid = Math.random() + "";
        $table.attr("table-uuid", uuid);
        // addTfoot($table);
        const table = $table.dataTable(this.dataTablesConfig);
        this.appendFilter(table.api());
        this.tableList.push({uuid, table});
        edit && edit.parentNode.removeChild(edit);
        return uuid
    }

    removeDataTable = uuid => {
        const idx = this.tableList.findIndex(table => table.uuid === uuid);
        if (idx !== -1) {
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
    }

    dynamicCallArgsGenerator = anchorNode => {
        const table = anchorNode.closest("#write table.md-table");
        if (!table) return;

        const uuid = table.getAttribute("table-uuid");
        this.dynamicUtil.uuid = uuid;
        this.dynamicUtil.target = table;

        let arg_name = "增强表格";
        let arg_value = "convert_current";
        if (uuid) {
            arg_name = "转回普通表格";
            arg_value = "rollback_current";
        }
        return [{arg_name, arg_value}]
    }

    call = type => {
        if (type === "convert_current") {
            if (this.dynamicUtil.target) {
                this.newDataTable(this.dynamicUtil.target);
            }
        } else if (type === "rollback_current") {
            if (this.dynamicUtil.uuid) {
                this.removeDataTable(this.dynamicUtil.uuid);
            }
        }
    }
}

module.exports = {
    plugin: datatablesPlugin,
};
