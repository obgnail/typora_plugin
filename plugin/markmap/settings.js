const ATTRIBUTES_TO_SAVE = [
  "DEFAULT_TOC_OPTIONS", "DOWNLOAD_OPTIONS", "WIDTH_PERCENT_WHEN_INIT", "HEIGHT_PERCENT_WHEN_INIT",
  "HEIGHT_PERCENT_WHEN_PIN_TOP", "WIDTH_PERCENT_WHEN_PIN_RIGHT", "POSITIONING_VIEWPORT_HEIGHT",
  "FIX_SKIPPED_LEVEL_HEADERS", "REMOVE_HEADER_STYLES", "CLICK_TO_POSITION", "HIGHLIGHT_PATH_ON_HOVER",
  "AUTO_FIT_ON_UPDATE", "AUTO_FIT_WHEN_FOLD", "RETAIN_FOLD_STATE_ON_UPDATE",
  "AUTO_COLLAPSE_PARAGRAPH_ON_FOLD", "NODE_TEXT_TEMPLATE",
]

const arr2Str = arr => arr.join("_")
const str2Arr = str => str.split("_")

const openTOCSettings = async ({ config, utils, i18n, fixedName }) => {
  let edited = false
  const markEdited = () => edited = true

  const { response, data } = await utils.formDialog.modal({
    title: i18n.t("$option.TITLE_BAR_BUTTONS.settings"),
    schema: getSchema({ config, utils, i18n }),
    data: getData({ config, utils }),
    features: { i18nAutoFill: { compile: fillLabels(i18n) } },
    actions: {
      restoreSettings: utils.createConsecutiveAction({
        threshold: 3,
        timeWindow: 3000,
        onConfirmed: async () => {
          await restoreDefaults({ config, utils, i18n, fixedName })
          markEdited()
        },
      }),
    },
    rules: {
      NODE_TEXT_TEMPLATE: "required",
      "DOWNLOAD_OPTIONS.FOLDER": "path",
      "DOWNLOAD_OPTIONS.FILENAME": "required",
    },
    hooks: { onCommit: markEdited },
  })

  if (response === 1 && edited) {
    await save({ config, utils, fixedName }, data)
    return true
  }
  return false
}

const getSchema = ({ config, utils, i18n }) => {
  const T = key => i18n.t(`$tooltip.${key}`)
  const pluginEnabled = utils.getPlugin("collapse_paragraph")
  const pixelUnit = i18n._t("settings", "$unit.pixel")

  const colorOptions = Object.fromEntries(
    [...config.CANDIDATE_COLOR_SCHEMES, config.DEFAULT_TOC_OPTIONS.color].map(colorList => {
      const colors = colorList
        .map(color => `<div style="background: ${color}; width: 34px; border-radius: 2px;"></div>`)
        .join("")
      return [arr2Str(colorList), `<div style="display: inline-flex; height: 22px;">${colors}</div>`]
    }),
  )

  return ({ Group, Controls: C, When }) => [
    C.Tabs("markmap_settings_tabs")
      .TabPosition("top")
      .TabStyle("line")
      .Tab({
        value: "color",
        schema: [
          C.Radio("DEFAULT_TOC_OPTIONS.color").Options(colorOptions),
          Group(
            C.Switch("DEFAULT_TOC_OPTIONS.colorByParent"),
            C.Switch("DEFAULT_TOC_OPTIONS.colorByLevel").ShowIf(When.false("DEFAULT_TOC_OPTIONS.colorByParent")),
            C.Range("DEFAULT_TOC_OPTIONS.colorFreezeLevel").Min(1).Max(7).Step(1).ShowIf(When.false("DEFAULT_TOC_OPTIONS.colorByParent")),
          ),
        ],
      })
      .Tab({
        value: "chart",
        schema: [Group(
          C.Range("DEFAULT_TOC_OPTIONS.spacingHorizontal").Min(0).Max(200).Step(1),
          C.Range("DEFAULT_TOC_OPTIONS.spacingVertical").Min(0).Max(100).Step(1),
          C.Range("DEFAULT_TOC_OPTIONS.paddingX").Min(0).Max(100).Step(1),
          C.Range("DEFAULT_TOC_OPTIONS.maxWidth").Tooltip(T("zero")).Min(0).Max(1000).Step(10),
          C.Range("DEFAULT_TOC_OPTIONS.nodeMinHeight").Min(5).Max(50).Step(1),
          C.Range("DEFAULT_TOC_OPTIONS.initialExpandLevel").Min(1).Max(7).Step(1),
        )],
      })
      .Tab({
        value: "window",
        schema: [Group(
          C.Range("DEFAULT_TOC_OPTIONS.fitRatio").Min(0.5).Max(1).Step(0.01),
          C.Range("DEFAULT_TOC_OPTIONS.maxInitialScale").Min(0.5).Max(5).Step(0.25),
          C.Range("WIDTH_PERCENT_WHEN_INIT").Min(20).Max(95).Step(1),
          C.Range("HEIGHT_PERCENT_WHEN_INIT").Min(20).Max(95).Step(1),
          C.Range("HEIGHT_PERCENT_WHEN_PIN_TOP").Min(20).Max(95).Step(1),
          C.Range("WIDTH_PERCENT_WHEN_PIN_RIGHT").Min(20).Max(95).Step(1),
        )],
      })
      .Tab({
        value: "behavior",
        schema: [Group(
          C.Switch("FIX_SKIPPED_LEVEL_HEADERS"),
          C.Switch("REMOVE_HEADER_STYLES"),
          C.Text("NODE_TEXT_TEMPLATE").Tooltip(T("nodeTextTemplate")),
          C.Switch("RETAIN_FOLD_STATE_ON_UPDATE"),
          C.Switch("AUTO_FIT_ON_UPDATE"),
          C.Switch("AUTO_FIT_WHEN_FOLD"),
          C.Switch("AUTO_COLLAPSE_PARAGRAPH_ON_FOLD").Tooltip(T("experimental")).Disabled(!pluginEnabled),
        )],
      })
      .Tab({
        value: "interactive",
        schema: [Group(
          C.Switch("DEFAULT_TOC_OPTIONS.zoom"),
          C.Switch("DEFAULT_TOC_OPTIONS.pan"),
          C.Switch("DEFAULT_TOC_OPTIONS.toggleRecursively"),
          C.Switch("HIGHLIGHT_PATH_ON_HOVER"),
          C.Switch("CLICK_TO_POSITION"),
          C.Range("POSITIONING_VIEWPORT_HEIGHT").Tooltip(T("positioningViewPort")).Min(0.1).Max(0.95).Step(0.01).ShowIf(When.true("CLICK_TO_POSITION")),
          C.Range("DEFAULT_TOC_OPTIONS.duration").Min(0).Max(1000).Step(10),
        )],
      })
      .Tab({
        value: "download",
        schema: [Group(
          C.Switch("DOWNLOAD_OPTIONS.SHOW_PATH_INQUIRY_DIALOG"),
          C.Switch("DOWNLOAD_OPTIONS.SHOW_IN_FINDER"),
          C.Text("DOWNLOAD_OPTIONS.FOLDER").Tooltip(T("tempDir")).Placeholder(utils.tempFolder),
          C.Text("DOWNLOAD_OPTIONS.FILENAME"),
          C.Float("DOWNLOAD_OPTIONS.IMAGE_SCALE").Min(0.1).Step(0.1),
          C.Integer("DOWNLOAD_OPTIONS.PADDING_HORIZONTAL").Min(1).Step(1).Unit(pixelUnit),
          C.Integer("DOWNLOAD_OPTIONS.PADDING_VERTICAL").Min(1).Step(1).Unit(pixelUnit),
          C.Color("DOWNLOAD_OPTIONS.TEXT_COLOR"),
          C.Color("DOWNLOAD_OPTIONS.OPEN_CIRCLE_COLOR"),
          C.Color("DOWNLOAD_OPTIONS.BACKGROUND_COLOR").Tooltip(T("jpgFormatOnly")),
          C.Range("DOWNLOAD_OPTIONS.IMAGE_QUALITY").Tooltip(T("pixelImagesOnly")).Min(0.01).Max(1).Step(0.01),
          C.Switch("DOWNLOAD_OPTIONS.KEEP_ALPHA_CHANNEL"),
          C.Switch("DOWNLOAD_OPTIONS.REMOVE_USELESS_CLASSES"),
          C.Switch("DOWNLOAD_OPTIONS.REMOVE_FOREIGN_OBJECT").Tooltip(T("removeForeignObj")),
        )],
      }),
    C.Action("restoreSettings").Label(i18n._t("settings", "$label.restoreSettings")),
  ]
}

const getData = ({ config, utils }) => {
  const data = utils.naiveCloneDeep(utils.pick(config, ATTRIBUTES_TO_SAVE))
  data.DEFAULT_TOC_OPTIONS.color = arr2Str(data.DEFAULT_TOC_OPTIONS.color)
  return data
}

const save = async ({ config, utils, fixedName }, result) => {
  result.DEFAULT_TOC_OPTIONS.color = str2Arr(result.DEFAULT_TOC_OPTIONS.color)
  Object.assign(config, result)
  await utils.settings.save(fixedName, result)
}

const restoreDefaults = async ({ config, utils, i18n, fixedName }) => {
  await utils.settings.handle(fixedName, (pluginSettings, allSettings) => {
    allSettings[fixedName] = utils.pickBy(pluginSettings, (_, k) => !ATTRIBUTES_TO_SAVE.includes(k))
  })
  const settings = await utils.settings.read()
  Object.assign(config, settings[fixedName])
  utils.notification.show(i18n.t("success.restore"))
  await utils.formDialog.refresh(op => {
    op.schema = getSchema({ config, utils, i18n })
    op.data = getData({ config, utils })
  })
}

const fillLabels = i18n => ({ form }) => {
  form.traverseFields(field => {
    if (field.key && !field.label) {
      field.label = i18n.t(`$label.${field.key}`)
    }
    if (field.type === "tabs" && Array.isArray(field.tabs)) {
      field.tabs.forEach(tab => {
        if (tab.value && !tab.label) {
          tab.label = i18n.t(`title.${tab.value}`)
        }
      })
    }
  })
}

module.exports = { openTOCSettings }
