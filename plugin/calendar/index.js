class CalendarPlugin extends BasePlugin {
    init = () => this.Calendar = null

    call = () => this.utils.insertBlockCode(null, this.config.LANGUAGE, this.config.TEMPLATE)

    process = () => {
        const parser = this.utils.thirdPartyDiagramParser
        parser.register({
            lang: this.config.LANGUAGE,
            mappingLang: "javascript",
            destroyWhenUpdate: false,
            interactiveMode: this.config.INTERACTIVE_MODE,
            checkSelector: ".plugin-calender-content",
            wrapElement: '<div class="plugin-calender-content"></div>',
            lazyLoadFunc: this.lazyLoad,
            beforeRenderFunc: null,
            setStyleFunc: parser.STYLE_SETTER({
                height: this.config.DEFAULT_FENCE_HEIGHT,
                "background-color": this.config.DEFAULT_FENCE_BACKGROUND_COLOR
            }),
            createFunc: this.create,
            updateFunc: null,
            destroyFunc: this.destroy,
            beforeExportToNative: null,
            beforeExportToHTML: null,
            extraStyleGetter: this.getStyleContent,
            versionGetter: this.getVersion,
        })
    }

    create = ($wrap, content) => {
        const container = $wrap[0]
        const Calendar = this.Calendar
        const calendar = new Calendar(container)
        let option = {}
        eval(content)
        calendar.setOptions(option)
        return calendar
    }

    destroy = instance => {
        instance.clear()
        instance.destroy()
    }

    getVersion = () => "2.1.3"

    lazyLoad = () => {
        this.utils.insertStyleFile("plugin-calendar-style", "./plugin/calendar/toastui-calendar.min.css")
        this.Calendar = require("./toastui-calendar.min.js")
    }

    getStyleContent = () => {
        const path = this.utils.joinPath("./plugin/calendar/toastui-calendar.min.css")
        return this.utils.Package.FsExtra.readFileSync(path, "utf-8")
    }
}

module.exports = {
    plugin: CalendarPlugin
}
