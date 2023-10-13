class calendarPlugin extends BaseCustomPlugin {
    init = () => {
        this.Calendar = null;
    }

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE)

    process = () => {
        this.utils.registerThirdPartyDiagramParser(
            this.config.LANGUAGE,
            false,
            this.config.INTERACTIVE_MODE,
            ".plugin-calender-content",
            '<div class="plugin-calender-content"></div>',
            {
                defaultHeight: this.config.DEFAULT_FENCE_HEIGHT,
                backgroundColor: this.config.DEFAULT_FENCE_BACKGROUND_COLOR
            },
            this.lazyLoad,
            this.create,
            this.destroy,
        );
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
            const {Calendar} = this.utils.requireFilePath("./plugin/custom/plugins/calendar/toastui-calendar.min.js");
            this.Calendar = Calendar;
        }
    }
}

module.exports = {
    plugin: calendarPlugin
};