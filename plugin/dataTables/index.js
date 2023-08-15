(() => {
    (() => {
        const cssFilepath = global._pluginUtils.joinPath("./plugin/dataTables/dataTables.min.css");
        global._pluginUtils.insertStyleFile("plugin-dataTables-style", cssFilepath);
        const jsFilepath = global._pluginUtils.joinPath("./plugin/dataTables/dataTables.min.js");
        $.getScript(`file:///${jsFilepath}`).then(() => console.log("dataTables.min.js has inserted"));
    })()

    const config = global._pluginUtils.getPluginSetting("dataTables");

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
                "lengthMenu": "显示 _MENU_ 项结果",
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
                    "first": "首页",
                    "previous": "上页",
                    "next": "下页",
                    "last": "末页"
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

    const newDataTable = target => {
        const uuid = Math.random() + "";
        const $table = $(target);
        $table.attr("table-uuid", uuid);
        const table = $table.dataTable(dataTablesConfig);
        tableList.push({uuid, table});
    }

    const removeTable = uuid => {
        const idx = tableList.findIndex(table => table.uuid === uuid);
        if (idx !== -1) {
            const table =tableList[idx].table;
            table.api().destroy();
            table[0].removeAttribute("table-uuid");
            tableList.splice(idx, 1);
        }
    }

    global._pluginUtils.decorateOpenFile(null, () => {
        tableList.forEach(table => table.api().destroy());
        tableList = [];
    })

    const dynamicUtil = {target: null, uuid: ""}
    const dynamicCallArgsGenerator = anchorNode => {
        const table = anchorNode.closest("#write table.md-table");
        if (!table) return;

        const uuid = table.getAttribute("table-uuid");
        dynamicUtil.uuid = uuid;
        dynamicUtil.target = table;

        let arg_name = "转为多功能表格";
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
                removeTable(dynamicUtil.uuid);
            }
        }
    }

    module.exports = {
        call,
        dynamicCallArgsGenerator,
    };

    console.log("dataTables.js had been injected");
})()