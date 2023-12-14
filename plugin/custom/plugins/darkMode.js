class darkModePlugin extends BaseCustomPlugin {
    init = () => {
        this.isDarkMode = false;
    }

    hotkey = () => [this.config.hotkey]

    createDarkFilter = () => {
        const div = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
        div.innerHTML = `
            <svg id="plugin-dark-mode-svg" style="height: 0; width: 0; position: absolute;">
                <filter id="plugin-dark-mode-filter" x="0" y="0" width="99999" height="99999">
                    <feColorMatrix type="matrix" values="0.283 -0.567 -0.567 0 0.925 -0.567 0.283 -0.567 0 0.925 -0.567 -0.567 0.283 0 0.925 0 0 0 1 0"/>
                </filter>
                <filter id="plugin-dark-mode-reverse-filter" x="0" y="0" width="99999" height="99999">
                    <feColorMatrix type="matrix" values="0.333 -0.667 -0.667 0 1 -0.667 0.333 -0.667 0 1 -0.667 -0.667 0.333 0 1 0 0 0 1 0"/>
                </filter>
            </svg>`
        const frag = document.createDocumentFragment();
        while (div.firstChild) {
            frag.appendChild(div.firstChild);
        }
        this.utils.insertElement(frag);
    }

    enableDarkMode = async () => {
        await this.utils.registerStyleTemplate(this.fixedName);
        this.createDarkFilter();
        this.isDarkMode = true;
    }

    disableDarkMode = () => {
        this.utils.unregisterStyleTemplate(this.fixedName);
        this.utils.removeElementByID("plugin-dark-mode-svg");
        this.isDarkMode = false;
    }

    process = () => {
        if (this.config.default_dark_mode) {
            this.enableDarkMode();
        }
    }

    callback = async () => {
        const func = this.isDarkMode ? this.disableDarkMode : this.enableDarkMode
        await func();
    }
}

module.exports = {
    plugin: darkModePlugin,
};