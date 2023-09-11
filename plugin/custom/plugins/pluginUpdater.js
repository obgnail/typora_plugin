class pluginUpdater extends BaseCustomPlugin {
    selector = () => (this.updaterExeExist && this.utils.getPlugin("commander")) ? "" : this.utils.nonExistSelector

    hint = () => "当你发现BUG，可以尝试更新，说不定就解决了"

    init = () => {
        this.proxyGetter = new ProxyGetter(this.utils);
        this.binFileUpdater = new binFileUpdater(this.utils);

        this.updaterExeExist = this.utils.existInPluginPath("./plugin/updater/updater.exe");

        new extraOperation(this.utils).run();
    }

    callback = anchorNode => {
        this.proxyGetter.getProxy().then(proxy => {
            proxy = proxy || "";
            if (!proxy.startsWith("http://")) {
                proxy = "http://" + proxy;
            }

            const modal = {
                title: "设置代理",
                components: [
                    {
                        label: "默认使用当前系统代理。你可以手动修改：",
                        type: "p",
                    },
                    {
                        label: "代理（为空则不设置）",
                        type: "input",
                        value: proxy,
                        placeholder: "http://127.0.0.1:7890",
                    }
                ]
            }

            this.modal(modal, components => {
                const dir = this.utils.joinPath("./plugin/updater");
                const updater = this.utils.joinPath("./plugin/updater/updater.exe");
                const proxy = (components[1].submit || "").trim();
                const cmd = `cd ${dir} && ${updater} --action=update --proxy=${proxy}`;
                this.utils.getPlugin("commander").echoExec(cmd, "cmd/bash", code => {
                    if (code === 0) {
                        this.binFileUpdater.run();
                    } else {
                        this.modal(
                            {title: "更新失败", components: [{label: "出于未知原因，更新失败，建议您稍后重试或手动更新", type: "p"}]},
                            () => this.utils.openUrl("https://github.com/obgnail/typora_plugin/releases/latest")
                        )
                    }
                }, "注意: 请勿通过手动执行updater.exe更新插件\n\n更新插件中，请稍等\n\n");
            })
        })
    }
}

// 处理每次升级后的额外操作
// 理论上是不需要用到此工具的，但是由于之前的updater.exe有缺陷，遗留下一些问题，被迫用此工具处理存量的脏文件，过段时间会删除掉此helper
class extraOperation {
    constructor(utils) {
        this.utils = utils
    }

    updateTo1_3_5 = () => {
        if (this.utils.existInPluginPath("./plugin/md_padding.js")) {
            [
                "./plugin/global/utils/md-padding",
                "./plugin/global/utils/node_modules",
                "./plugin/global/utils/package.json",
                "./plugin/global/utils/package-lock.json",
                "./plugin/md_padding.js",
            ].forEach(path => this.utils.Package.FsExtra.remove(this.utils.joinPath(path)))
        }
    }

    updateTo1_3_10 = () => {
        const file = this.utils.joinPath("./plugin/custom/plugins/modalExample.js");
        this.utils.existPath(file) && this.utils.Package.FsExtra.remove(file);
    }

    run = () => {
        new binFileUpdater(this.utils).run();
        this.updateTo1_3_5();
        this.updateTo1_3_10();
    }
}

class binFileUpdater {
    constructor(utils) {
        this.utils = utils
    }

    run = () => {
        const binFile = this.getBinFile();
        if (!binFile) return

        this.utils.Package.Fs.unlink(binFile.delete, err => {
            if (err) throw err;
            const filepath = this.utils.Package.Path.join(this.utils.Package.Path.dirname(binFile.remain), "updater.exe");
            this.utils.Package.Fs.rename(binFile.remain, filepath, err => {
                if (err) throw err;
            })
        })
    }

    getBinFile = () => {
        const fileList = []
        const regexp = new RegExp(/updater(?<version>\d+\.\d+\.\d+)?\.exe/);
        const dir = this.utils.joinPath("./plugin/updater");
        this.utils.Package.Fs.readdirSync(dir).forEach(file => {
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
        deleteFile = this.utils.Package.Path.join(dir, deleteFile);
        remainFile = this.utils.Package.Path.join(dir, remainFile);
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

class ProxyGetter {
    constructor(utils) {
        this.utils = utils
    }

    getProxy = () => {
        if (File.isLinux) {
            return this.getLinuxProxy()
        } else if (File.isWin) {
            return this.getWindowsProxy()
        } else if (File.isMac) {
            return this.getMacProxy()
        } else {
            return ""
        }
    }

    getWindowsProxy = () => {
        return new Promise(resolve => {
            this.utils.Package.ChildProcess.exec(`reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" | find /i "proxyserver"`,
                (err, stdout, stderr) => {
                    if (err || stderr) {
                        resolve(null);
                    } else {
                        const match = stdout.match(/ProxyServer\s+REG_SZ\s+(.*)/i);
                        if (match && match[1]) {
                            resolve(match[1]);
                        } else {
                            resolve(null);
                        }
                    }
                });
        });
    };

    getMacProxy = () => {
        return new Promise(resolve => {
            this.utils.Package.ChildProcess.exec('networksetup -getwebproxy "Wi-Fi"',
                (err, stdout, stderr) => {
                    if (err || stderr) {
                        resolve(null);
                    } else {
                        const match = stdout.match(/Enabled: (.+)\nServer: (.+)\nPort: (.+)\n/i);
                        if (match && match[1] === 'Yes' && match[2] && match[3]) {
                            resolve(`${match[2]}:${match[3]}`);
                        } else {
                            resolve(null);
                        }
                    }
                });
        });
    };

    getLinuxProxy = () => {
        return new Promise(resolve => {
            this.utils.Package.Fs.readFile('/etc/environment', 'utf8',
                (err, data) => {
                    if (err) {
                        resolve(null);
                    } else {
                        const match = data.match(/http_proxy=(.+)/i);
                        if (match && match[1]) {
                            resolve(match[1]);
                        } else {
                            resolve(null);
                        }
                    }
                });
        });
    };
}


module.exports = {
    plugin: pluginUpdater
};