class pluginUpdater extends BaseCustomPlugin {
    selector = () => (this.updaterExist && this.utils.getPlugin("commander")) ? "" : this.utils.nonExistSelector

    hint = () => "当你发现BUG，可以尝试更新，指不定就解决了"

    init = () => {
        this.dir = this.utils.joinPath("./plugin/updater");
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
        new ProxyGetter(this.utils).getProxy().then(proxy => {
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
                        label: "代理(为空则不设置)",
                        type: "input",
                        value: proxy,
                        placeholder: "http://127.0.0.1:7890",
                    }
                ]
            }

            this.modal(modal, components => {
                const proxy = (components[1].submit || "").trim();
                const cmd = `cd ${this.dir} && ${this.updater} --action=update --proxy=${proxy}`;
                this.utils.getPlugin("commander").alwaysExec(cmd, "cmd/bash");
            })
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