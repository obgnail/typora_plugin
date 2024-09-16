/**
 * 注册额外的HTML和CSS
 */
class extra {
    constructor(utils) {
        this.utils = utils;
    }

    registerCSS = async () => {
        const files = ["plugin-common", "customize"];
        return Promise.all(files.map(f => this.utils.styleTemplater.register(f)));
    }

    registerHTML = () => {
        this.utils.insertElement(`
            <span class="plugin-wait-mask-wrapper plugin-common-hidden">
                <span class="plugin-wait-mask">
                    <span class="plugin-wait-label">Processing</span>
                    <span class="truncate-line"></span><span class="truncate-line"></span><span class="truncate-line"></span>
                </span>
            </span>
        `);
    }

    process = async () => {
        this.registerHTML();
        await this.registerCSS();
    }
}

module.exports = {
    extra
}