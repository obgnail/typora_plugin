const createBookmarkStore = ({ utils, fixedName, recordSelector, className }) => {
  let jump = null  // { file, idx, at, consumed } | null

  const locate = {
    getEl: idx => [...document.querySelectorAll(recordSelector)][idx],
    scrollTo: idx => {
      const el = locate.getEl(idx)
      if (el) utils.scrollTo(el, { height: 20, moveCursor: true })
    },
  }

  const recorder = {
    register: () => utils.stateRecorder.register({
      name: fixedName,
      selector: recordSelector,
      stateGetter: el => el.classList.contains(className),
      stateRestorer: el => el.classList.add(className),
      finalFn: () => {
        if (!jump || jump.consumed) return
        if (jump.file === utils.getFilePath()) {
          locate.scrollTo(jump.idx)
        }
        jump.consumed = true
      },
    }),
    collect: () => utils.stateRecorder.collect(fixedName),
    getState: () => utils.stateRecorder.getState(fixedName),
  }

  return {
    register: recorder.register,
    collect: recorder.collect,
    rows: () => [...recorder.getState()].flatMap(([file, idxMap]) =>
      [...idxMap.keys()].map(idx => ({ file, fileName: utils.getFileName(file), idx })),
    ),
    mark: el => el.classList.add(className),
    unmark: ({ file, idx }) => {
      if (utils.getFilePath() === file) {
        locate.getEl(idx)?.classList.remove(className)
      } else {
        recorder.getState().get(file)?.delete(idx)
      }
    },
    jump: ({ file, idx }) => {
      if (file && utils.getFilePath() !== file) {
        jump = { file, idx, at: Date.now(), consumed: false }
        utils.openFile(file)
      } else {
        locate.scrollTo(idx)
      }
    },
    isInJumpCooldown: () => !!jump && Date.now() <= jump.at + 2000,
    hasBookmarksInFile: (file = utils.getFilePath()) => !!recorder.getState().get(file)?.size,
  }
}

class BookmarkPlugin extends BasePlugin {
  recordSelector = "#write [cid]"
  className = "plu-bookmark"
  store = createBookmarkStore({
    utils: this.utils,
    fixedName: this.fixedName,
    recordSelector: this.recordSelector,
    className: this.className,
  })

  style = () => `
#plugin-bookmark { --bookmark-width: 420px; top: 80px; left: calc(100vw - var(--bookmark-width) - 20px); width: var(--bookmark-width); }
#plugin-bookmark::part(content-area) { padding: 8px; }
.plugin-bookmark-table { --table-max-height: 300px; --cell-padding-y: 8px; --cell-padding-x: 12px; }`

  html = () => `
    <fast-window id="plugin-bookmark" window-title="${this.pluginName}" window-buttons="close|fa-times" hidden>
      <fast-table class="plugin-bookmark-table"></fast-table>
    </fast-window>`

  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  init = () => {
    this.entities = {
      write: this.utils.entities.eWrite,
      panel: document.querySelector("#plugin-bookmark"),
      table: document.querySelector(".plugin-bookmark-table"),
    }
    this.entities.table.setSchema({
      defaultSort: { key: "fileName", direction: "asc" },
      columns: [
        { key: "fileName", title: "File", sortable: true },
        { key: "idx", title: "Index", sortable: true, width: "max-content" },
        { key: "operations", title: "", width: "max-content", render: () => `<i class="fa fa-trash-o action-icon danger" action="delete"></i>` },
      ],
    })
  }

  process = () => {
    this.store.register()

    this.utils.eventHub.on(this.utils.eventHub.eventType.fileEdited, () => {
      if (!this.store.isInJumpCooldown() && this.store.hasBookmarksInFile()) this.refresh()
    })

    const isModifierKeyPressed = this.utils.modifierKey(this.config.MODIFIER_KEY)
    this.entities.write.addEventListener("click", ev => {
      if (!isModifierKeyPressed(ev)) return
      const node = ev.target.closest(this.recordSelector)
      if (!node) return
      this.store.mark(node)
      if (this.config.AUTO_POPUP_WINDOW) {
        this.entities.panel.show()
      }
      this.refresh()
    })
    this.entities.table.addEventListener("row-click", ev => this.store.jump(ev.detail.rowData))
    this.entities.table.addEventListener("row-action", ev => {
      const { action, rowData } = ev.detail
      if (action !== "delete") return
      this.store.unmark(rowData)
      this.refresh()
    })
    this.entities.panel.addEventListener("btn-click", ev => {
      if (ev.detail.action === "close") this.entities.panel.hide()
    })
  }

  call = () => {
    this.entities.panel.toggle()
    this.refresh()
  }

  refresh = () => {
    this.store.collect()
    if (!this.entities.panel.hidden) {
      this.entities.table.setData(this.store.rows())
    }
  }
}

module.exports = {
  plugin: BookmarkPlugin,
}
