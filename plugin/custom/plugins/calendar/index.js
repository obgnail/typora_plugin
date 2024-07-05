class calendarPlugin extends BaseCustomPlugin {
    init = () => {
        this.Calendar = null;
    }

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE)

    process = () => {
        this.utils.thirdPartyDiagramParser.register({
            lang: this.config.LANGUAGE,
            mappingLang: "javascript",
            destroyWhenUpdate: false,
            interactiveMode: this.config.INTERACTIVE_MODE,
            checkSelector: ".plugin-calender-content",
            wrapElement: '<div class="plugin-calender-content"></div>',
            css: {
                height: this.config.DEFAULT_FENCE_HEIGHT,
                "background-color": this.config.DEFAULT_FENCE_BACKGROUND_COLOR
            },
            lazyLoadFunc: this.lazyLoad,
            createFunc: this.create,
            destroyFunc: this.destroy,
            beforeExport: null,
            extraStyleGetter: null,
        })
    }

    create = ($wrap, content) => {
        const Calendar = this.Calendar;
        const calendar = new this.Calendar($wrap[0]);
        let option = "";
        eval(content);
        calendar.setOptions(option);
        return calendar;
    }

    destroy = instance => {
        instance.clear();
        instance.destroy();
    }

    lazyLoad = () => {
        if (!this.Calendar) {
            this.utils.insertStyleFile("plugin-calendar-style", "./plugin/custom/plugins/calendar/toastui-calendar.min.css");
            const {Calendar} = require("./toastui-calendar.min.js");
            this.Calendar = Calendar;
        }
    }
}

module.exports = {
    plugin: calendarPlugin
};