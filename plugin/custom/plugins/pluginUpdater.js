class pluginUpdater extends BaseCustomPlugin {
    selector = () => (this.updaterExist && this.commander) ? "" : this.utils.nonExistSelector

    init = () => {
        this.dir = this.utils.joinPath("./plugin/updater");
        this.commander = this.utils.getPlugin("commander");
        this.updater = this.utils.joinPath("./plugin/updater/updater.exe");
        this.updaterExist = this.utils.existPath(this.updater);

        const binFile = this.getBinFile();
        if (!binFile) return

        const deleteFile = this.utils.Package.Path.join(this.dir, binFile.delete);
        this.utils.Package.Fs.unlink(deleteFile, err => {
            if (err) throw err;
            const remainFile = this.utils.Package.Path.join(this.dir, binFile.remain);
            const filepath = this.utils.Package.Path.join(this.utils.Package.Path.dirname(remainFile), "updater.exe");
            this.utils.Package.Fs.rename(remainFile, filepath, err => {
                if (err) throw err;
                this.updater = this.utils.joinPath("./plugin/updater/updater.exe");
                this.updaterExist = this.utils.existPath(this.updater);
            })
        })
    }

    callback = anchorNode => {
        const modal = {
            title: "设置代理",
            components: [
                {
                    label: "设置代理，为空则不设置",
                    type: "input",
                    value: "",
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

    getBinFile = () => {
        const fileList = []
        const regexp = new RegExp(/updater(?<version>\d+\.\d+\.\d+)?\.exe/);
        this.utils.Package.Fs.readdirSync(this.dir).forEach(file => {
            const m = file.match(regexp);
            if (!m) return
            const version = m.groups.version || "";
            fileList.push({file, version})
        });

        if (fileList.length !== 2) return

        const compare = this.compareVersion(fileList[0].version, fileList[1].version);
        let deleteFile, remainFile
        if (compare === 1) {
            deleteFile = fileList[1].file;
            remainFile = fileList[0].file;
        } else {
            deleteFile = fileList[0].file;
            remainFile = fileList[1].file;
        }
        return {delete: deleteFile, remain: remainFile}
    }

    compareVersion = (v1, v2) => {
        if (v1 === "" && v2 !== "") {
            return -1
        } else if (v2 === "" && v1 !== "") {
            return 1
        }
        const v1Arr = v1.split(".");
        const v2Arr = v2.split(".");
        for (let i = 0; i < v1Arr.length || i < v2Arr.length; i++) {
            const n1 = (i < v1Arr.length) ? parseInt(v1Arr[i]) : 0;
            const n2 = (i < v2Arr.length) ? parseInt(v2Arr[i]) : 0;
            if (n1 > n2) {
                return 1
            } else if (n1 < n2) {
                return -1
            }
        }
        return 0
    }
}


module.exports = {
    plugin: pluginUpdater
};