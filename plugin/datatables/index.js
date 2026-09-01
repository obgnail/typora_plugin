class DataTablesPlugin extends BasePlugin {
  dataTablesConfig = null
  tableList = []

  process = () => {
    this.utils.eventHub.on(this.utils.eventHub.eventType.otherFileOpened, this.destroyAllDataTable)
    this.utils.eventHub.on(this.utils.eventHub.eventType.beforeToggleSourceMode, this.destroyAllDataTable)
    this.utils.decorator.preventCallIf(() => File?.editor?.tableEdit, "showTableEdit", (...args) => {
      const table = args[0]?.find?.("table")
      if (!table || table.length === 0) return false
      const uuid = table.attr("table-uuid")
      return this.tableList.some(t => t.uuid === uuid)
    })
  }

  destroyAllDataTable = () => {
    while (this.tableList.length) {
      this.removeDataTable(this.tableList[0].uuid)
    }
    this.tableList = []
  }

  // addTfoot = $table => {
  //   const th = $table.find("thead th")
  //   const list = [...th].map(el => `<td>${el.textContent}: </td>`)
  //   const tfoot = `<tfoot><tr>${list.join("")}</tr></tfoot>`
  //   $table.append(tfoot)
  // }

  appendFilter = dataTable => {
    dataTable.columns().flatten().each(function (colIdx) {
      const select = $("<select />").appendTo(dataTable.column(colIdx).header())
        .on("change", function () {
          dataTable.column(colIdx).search($(this).val()).draw()
        })
        .on("click", () => false)
      select.append($(`<option value=""></option>>`))
      dataTable.column(colIdx).cache("search").sort().unique().each(d => select.append($(`<option value="${d}">${d}</option>>`)))
    })
  }

  lazyLoad = async () => {
    if ($?.fn?.dataTable) return
    this.initDataTablesConfig()
    this.utils.insertStyle(this.fixedName, this._buildCSS())
    this.utils.insertStyleFile("datatables-common", "./plugin/datatables/resource/css/dataTables.min.css")
    await $.getScript(this.utils.toFileProtocol(this.utils.joinPluginPath("./plugin/datatables/resource/js/dataTables.min.js")))
  }

  _buildCSS = () => `
#write figure select, #write figure input { border: 1px solid #ddd; box-shadow: inset 0 1px 1px rgba(0, 0, 0, .075); border-radius: 2px; height: 27px; margin-top: 5px; margin-bottom: 1px; max-width: 10em; }
.dataTables_wrapper .dataTables_paginate .paginate_button { padding: 0.05em 0.1em; }
.dataTables_wrapper .dataTables_length, .dataTables_filter { margin-bottom: 0.25em; }
.dataTables_wrapper .dataTables_info { padding-top: 0.25em; }`

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
      },
    }
    if (!this.config.DEFAULT_ORDER) {
      this.dataTablesConfig.order = []
    }
  }

  newDataTable = async target => {
    if (!target) return
    await this.lazyLoad()
    const edit = target.parentElement.querySelector(".md-table-edit")
    const $table = $(target)
    const uuid = this.utils.randomString()
    $table.attr("table-uuid", uuid)
    // addTfoot($table)
    const table = $table.dataTable(this.dataTablesConfig)
    this.appendFilter(table.api())
    this.tableList.push({ uuid, table })
    edit?.remove()
    return uuid
  }

  removeDataTable = uuid => {
    if (!uuid || !this.tableList.length) return
    const idx = this.tableList.findIndex(t => t.uuid === uuid)
    if (idx === -1) return

    const table = this.tableList[idx].table
    const target = table[0]
    table.api().destroy()
    target.removeAttribute("table-uuid")
    this.tableList.splice(idx, 1)
    target.querySelectorAll("th select").forEach(el => el.remove())
    if (target) {
      const $fig = $(target.parentElement)
      File.editor.tableEdit.showTableEdit($fig)
    }
  }

  getDynamicActions = (anchorNode, meta) => {
    const table = anchorNode.closest("#write table.md-table")
    const uuid = table?.getAttribute("table-uuid")
    meta.uuid = uuid
    meta.target = table
    const act = {
      act_name: this.i18n.t(uuid ? "act.revert_table" : "act.enhance_table"),
      act_value: uuid ? "revert_table" : "enhance_table",
      act_hint: !table ? this.i18n.t("actHint.positioningTable") : "",
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
  plugin: DataTablesPlugin,
}
