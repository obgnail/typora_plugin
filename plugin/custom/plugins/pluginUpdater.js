class pluginUpdater extends BaseCustomPlugin {
    selector = () => (this.updaterExist && this.commander) ? "" : this.utils.nonExistSelector

    init = () => {
        this.dir = this.utils.joinPath("./plugin/updater");
        this.updater = this.utils.joinPath("./plugin/updater/updater.exe");
        this.updaterExist = this.utils.existPath(this.updater);
        this.commander = this.utils.getPlugin("commander");
    }

    callback = anchorNode => {
        const modal = {
            title: "设置代理",
            components: [
                {
                    label: "设置代理，为空则不设置",
                    type: "input",
                    value: "http://127.0.0.1:7890",
                    placeholder: "http://127.0.0.1:7890",
                }
            ]
        }

        this.modal(modal, components => {
            const proxy = components[0].submit;
            const cmd = `cd ${this.dir} && ${this.updater} --action=update --proxy=${proxy}`;
            this.commander.alwaysExec(cmd, "cmd/bash")
        })
    }
}


module.exports = {
    plugin: pluginUpdater
};