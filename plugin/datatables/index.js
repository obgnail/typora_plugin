(() => {
    (() => {
        const cssFilepath = global._pluginUtils.joinPath("./plugin/datatables/resource/datatables.min.css");
        global._pluginUtils.insertStyleFile("plugin-datatables-common-style", cssFilepath);

        const css = `
            #write figure select,
            #write figure input {
                border: 1px solid #ddd;
                box-shadow: inset 0 1px 1px rgba(0, 0, 0, .075);
                border-radius: 2px;
                height: 27px;
                margin-top: 5px;
                margin-bottom: 1px;
                max-width: 200px;
            }

            figure .dataTables_length, .dataTables_filter {
                margin-bottom: 10px;
            }
        `
        global._pluginUtils.insertStyle("plugin-datatables-custom-style", css);

        const jsFilepath = global._pluginUtils.joinPath("./plugin/datatables/resource/datatables.min.js");
        $.getScript(`file:///${jsFilepath}`).then(() => console.log("datatables.min.js has inserted"));
    })()

    const config = global._pluginUtils.getPluginSetting("datatables");

    const dataTablesConfig = (() => {
        const cfg = {
            paging: config.PAGING,
            ordering: config.ORDERING,
            searching: config.SEARCHING,
            pageLength: config.PAGE_LENGTH,
            scrollCollapse: config.SROLL_COLLAPSE,
            processing: true,
            search: {
                caseInsensitive: config.CASE_INSENSITIVE,
                regex: config.REGEX,
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

        if (config.SCROLLY > 0) {
            cfg["scrollY"] = config.SCROLLY;
        }
        if (!config.DEFAULT_ORDER) {
            cfg["order"] = [];
        }
        return cfg
    })()

    let tableList = [];

    const addTfoot = $table => {
        const th = $table.find("thead th");
        const list = [...th].map(ele => `<td>${ele.textContent}: </td>`);
        const tfoot = `<tfoot><tr>${list.join("")}</tr></tfoot>`;
        $table.append(tfoot);
    }

    const appendFilter = dataTable => {
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

    const newDataTable = target => {
        const edit = target.parentElement.querySelector(".md-table-edit");
        const uuid = Math.random() + "";
        const $table = $(target);
        $table.attr("table-uuid", uuid);
        // addTfoot($table);
        const table = $table.dataTable(dataTablesConfig);
        appendFilter(table.api());
        tableList.push({uuid, table});
        edit && edit.parentNode.removeChild(edit);
    }

    const removeTable = (target, uuid) => {
        const idx = tableList.findIndex(table => table.uuid === uuid);
        if (idx !== -1) {
            const table = tableList[idx].table;
            table.api().destroy();
            table[0].removeAttribute("table-uuid");
            tableList.splice(idx, 1);
            target.querySelectorAll("th select").forEach(ele => ele.parentNode.removeChild(ele));
            if (target) {
                const $fig = $(target.parentElement);
                File.editor.tableEdit.showTableEdit($fig);
            }
        }
    }

    global._pluginUtils.decorateOpenFile(null, () => {
        tableList.forEach(table => table.api().destroy());
        tableList = [];
    })

    global._pluginUtils.decorate(
        () => (File && File.editor && File.editor.tableEdit && File.editor.tableEdit.showTableEdit),
        File.editor.tableEdit,
        "showTableEdit",
        (...args) => {
            const table = args[0].find("table");
            if (table.length === 0) return

            const uuid = table.attr("table-uuid");
            const idx = tableList.findIndex(table => table.uuid === uuid);
            if (idx !== -1) {
                return global._pluginUtils.stopCallError
            }
        },
        null
    )

    const dynamicUtil = {target: null, uuid: ""}
    const dynamicCallArgsGenerator = anchorNode => {
        const table = anchorNode.closest("#write table.md-table");
        if (!table) return;

        const uuid = table.getAttribute("table-uuid");
        dynamicUtil.uuid = uuid;
        dynamicUtil.target = table;

        let arg_name = "增强表格";
        let arg_value = "convert_current";
        if (uuid) {
            arg_name = "转回普通表格";
            arg_value = "rollback_current";
        }
        return [{arg_name, arg_value}]
    }

    const call = type => {
        if (type === "convert_current") {
            if (dynamicUtil.target) {
                newDataTable(dynamicUtil.target);
            }
        } else if (type === "rollback_current") {
            if (dynamicUtil.target && dynamicUtil.uuid) {
                removeTable(dynamicUtil.target, dynamicUtil.uuid);
            }
        }
    }

    module.exports = {
        call,
        dynamicCallArgsGenerator,
    };

    console.log("datatables.js had been injected");
})()