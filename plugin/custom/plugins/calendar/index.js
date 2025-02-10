class calendarPlugin extends BaseCustomPlugin {
    init = () => this.Calendar = null

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE)

    process = () => {
        const parser = this.utils.thirdPartyDiagramParser
        parser.register({
            lang: this.config.LANGUAGE,
            mappingLang: "javascript",
            destroyWhenUpdate: false,
            interactiveMode: this.config.INTERACTIVE_MODE,
            checkSelector: ".plugin-calender-content",
            wrapElement: '<div class="plugin-calender-content"></div>',
            setStyleFunc: parser.STYLE_SETTER({
                height: this.config.DEFAULT_FENCE_HEIGHT,
                "background-color": this.config.DEFAULT_FENCE_BACKGROUND_COLOR
            }),
            lazyLoadFunc: this.lazyLoad,
            createFunc: this.create,
            updateFunc: null,
            destroyFunc: this.destroy,
            beforeExportToNative: null,
            beforeExportToHTML: null,
            extraStyleGetter: null,
            versionGetter: this.versionGetter,
        })
    }

    create = ($wrap, content) => {
        const Calendar = this.Calendar
        const calendar = new this.Calendar($wrap[0])
        let option = {}
        eval(content)
        calendar.setOptions(option)
        return calendar
    }

    destroy = instance => {
        instance.clear()
        instance.destroy()
    }

    versionGetter = () => "2.1.3"

    lazyLoad = () => {
        this.utils.insertStyleFile("plugin-calendar-style", "./plugin/custom/plugins/calendar/toastui-calendar.min.css")
        const { Calendar } = require("./toastui-calendar.min.js")
        this.Calendar = Calendar
    }
}

module.exports = {
    plugin: calendarPlugin
}