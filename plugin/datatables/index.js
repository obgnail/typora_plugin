const createTableEnhancer = ({ utils, i18n, config, fixedName }) => {
  const tables = new Map()  // uuid -> DataTables

  const buildCSS = () => `
#write figure select, #write figure input { border: 1px solid #ddd; box-shadow: inset 0 1px 1px rgba(0, 0, 0, .075); border-radius: 2px; height: 27px; margin-top: 5px; margin-bottom: 1px; max-width: 10em; }
.dataTables_wrapper .dataTables_paginate .paginate_button { padding: 0.05em 0.1em; }
.dataTables_wrapper .dataTables_length, .dataTables_filter { margin-bottom: 0.25em; }
.dataTables_wrapper .dataTables_info { padding-top: 0.25em; }`

  const ensureLoaded = async () => {
    if ($?.fn?.dataTable) return
    utils.insertStyle(fixedName, buildCSS())
    utils.insertStyleFile("datatables-common", "./plugin/datatables/resource/css/dataTables.min.css")
    await utils.insertScript(utils.joinPluginPath("./plugin/datatables/resource/js/dataTables.min.js"))
  }

  const buildConfig = () => {
    const t = key => i18n.t(`tableConfig.${key}`)
    const cfg = {
      paging: config.PAGING,
      ordering: config.ORDERING,
      searching: config.SEARCHING,
      pageLength: config.PAGE_LENGTH,
      scrollCollapse: config.SCROLL_COLLAPSE,
      processing: true,
      search: { caseInsensitive: config.CASE_INSENSITIVE, regex: config.REGEX },
      language: {
        processing: t("processing"),
        lengthMenu: t("lengthMenu"),
        zeroRecords: t("zeroRecords"),
        info: t("info"),
        infoEmpty: t("infoEmpty"),
        infoFiltered: t("infoFiltered"),
        search: t("search"),
        emptyTable: t("emptyTable"),
        loadingRecords: t("loadingRecords"),
        infoPostFix: "",
        searchPlaceholder: "",
        url: "",
        infoThousands: ",",
        thousands: ".",
        paginate: { first: "<<", previous: "<", next: ">", last: ">>" },
      },
    }
    if (!config.DEFAULT_ORDER) {
      cfg.order = []
    }
    return cfg
  }

  const enhance = async target => {
    if (!target) return
    await ensureLoaded()

    const uuid = utils.randomString()
    const $table = $(target).attr("table-uuid", uuid)
    const table = $table.dataTable(buildConfig())
    appendColumnFilter(table.api())
    tables.set(uuid, table)
    target.parentElement.querySelector(".md-table-edit")?.remove()
    return uuid
  }

  const revert = uuid => {
    const table = tables.get(uuid)
    if (!table) return

    const target = table[0]
    table.api().destroy()
    target.removeAttribute("table-uuid")
    target.querySelectorAll("th select").forEach(el => el.remove())
    tables.delete(uuid)
    File.editor.tableEdit.showTableEdit($(target.parentElement))
  }

  const revertAll = () => tables.keys().forEach(uuid => revert(uuid))

  return { has: uuid => tables.has(uuid), enhance, revert, revertAll }
}

const appendColumnFilter = api => {
  api.columns().flatten().each(colIdx => {
    const column = api.column(colIdx)
    const select = $("<select />").appendTo(column.header())
      .on("change", () => column.search(select.val()).draw())
      .on("click", () => false)
    select.append($("<option value=''></option>"))
    column.cache("search").sort().unique().each(d => select.append($(`<option value="${d}">${d}</option>`)))
  })
}

class DataTablesPlugin extends BasePlugin {
  enhancer = createTableEnhancer(this)

  process = () => {
    const { eventHub, decorator } = this.utils
    eventHub.on(eventHub.eventType.otherFileOpened, this.enhancer.revertAll)
    eventHub.on(eventHub.eventType.beforeToggleSourceMode, this.enhancer.revertAll)
    decorator.preventCallIf(() => File?.editor?.tableEdit, "showTableEdit", (...args) => {
      const table = args[0]?.find?.("table")
      return !!table?.length && this.enhancer.has(table.attr("table-uuid"))
    })
  }

  getDynamicActions = (anchorNode, meta) => {
    meta.target = anchorNode.closest("#write table.md-table")
    meta.uuid = meta.target?.getAttribute("table-uuid")
    const enhanced = !!meta.uuid
    return [{
      act_name: this.i18n.t(enhanced ? "act.revert_table" : "act.enhance_table"),
      act_value: enhanced ? "revert_table" : "enhance_table",
      act_hint: meta.target ? "" : this.i18n.t("actHint.positioningTable"),
      act_disabled: !meta.target,
    }]
  }

  call = async (action, meta) => {
    if (action === "enhance_table") {
      await this.enhancer.enhance(meta.target)
    } else if (action === "revert_table") {
      this.enhancer.revert(meta.uuid)
    }
  }
}

module.exports = {
  plugin: DataTablesPlugin,
}
