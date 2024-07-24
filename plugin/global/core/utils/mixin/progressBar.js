class progressBar {
    constructor(utils) {
        this.utils = utils;
        this.progressBar = null;
    }

    process = async () => {
        await this.utils.styleTemplater.register("plugin-common-progress-bar");
        this.utils.insertElement(`<progress class="plugin-common-progress-bar" max="100" value="0"></progress>`);
        this.progressBar = document.querySelector(".plugin-common-progress-bar");
    }

    show = percent => this.progressBar.value = percent;
    hide = () => this.progressBar.value = 0;
}

module.exports = {
    progressBar
}
