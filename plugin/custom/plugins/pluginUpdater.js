class pluginUpdater extends BaseCustomPlugin {
    selector = () => (this.updaterExeExist && this.commanderPlugin) ? "" : this.utils.nonExistSelector

    hint = () => "当你发现BUG，可以尝试更新，说不定就解决了"

    init = () => {
        this.updaterExeExist = this.utils.existInPluginPath("./plugin/updater/updater.exe");
    }

    process = () => {
        this.utils.addEventListener(this.utils.eventType.allPluginsHadInjected, () => {
            this.commanderPlugin = this.utils.getPlugin("commander");

            if (this.config.auto_update && this.commanderPlugin) {
                setTimeout(async () => {
                    console.log("start update...");
                    const proxy = await this.getProxy();
                    await this.update(proxy, this.config.auto_exec_show);
                }, this.config.start_update_interval)
            }
        })
    }

    callback = async anchorNode => {
        const proxy = await this.getProxy();
        const modal = {
            title: "设置代理",
            components: [
                {label: "默认使用当前系统代理。你可以手动修改：", type: "p"},
                {label: "代理（为空则不设置）", type: "input", value: proxy, placeholder: "http://127.0.0.1:7890"}
            ]
        }

        this.modal(modal, async components => {
            const proxy = (components[1].submit || "").trim();
            await this.update(proxy, this.config.exec_show, "升级中，请稍等\n\n", code => {
                this.adjustFile();
                if (code !== 0) {
                    this.modal(
                        {title: "更新失败", components: [{label: "出于未知原因，更新失败，建议您稍后重试或手动更新", type: "p"}]},
                        () => this.utils.openUrl("https://github.com/obgnail/typora_plugin/releases/latest")
                    )
                }
            })
        })
    }

    getProxy = async () => {
        let proxy = (await new ProxyGetter(this.utils).getProxy()) || "";
        if (!proxy.startsWith("http://")) {
            proxy = "http://" + proxy;
        }
        return proxy
    }

    // 保不齐有些用户就是不守规矩，升级前和升级后都执行一次
    adjustFile = async () => {
        await new binFileUpdater(this.utils).run();
        await new extraOperation(this.utils).run();
    }

    update = async (proxy, exec, hint, callback) => {
        callback = callback || this.adjustFile;
        await this.adjustFile();
        const dir = this.utils.joinPath("./plugin/updater");
        const cmd = `updater.exe --action=update --proxy=${proxy}`;
        this.commanderPlugin.execute(exec, cmd, "cmd/bash", callback, hint, {cwd: dir});
    }
}

// 处理每次升级后的额外操作
// 理论上是不需要用到此工具的，但是由于之前的updater.exe有缺陷，遗留下一些问题，被迫用此工具处理存量的脏文件
// 过段时间会删除掉此helper，不过保留也没啥问题，毕竟只在升级的时候执行
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

    run = async () => {
        this.updateTo1_3_5();
        this.updateTo1_3_10();
    }
}

class binFileUpdater {
    constructor(utils) {
        this.utils = utils
    }

    run = async () => {
        const binFile = await this.getBinFile();
        if (binFile) {
            await this.utils.Package.Fs.promises.unlink(binFile.delete);
            const filepath = this.utils.Package.Path.join(this.utils.Package.Path.dirname(binFile.remain), "updater.exe");
            await this.utils.Package.Fs.promises.rename(binFile.remain, filepath);
        }
    }

    getBinFile = async () => {
        const fileList = []
        const regexp = new RegExp(/updater(?<version>\d+\.\d+\.\d+)?\.exe/);
        const dir = this.utils.joinPath("./plugin/updater");

        const filenames = await this.utils.Package.Fs.promises.readdir(dir);
        filenames.forEach(file => {
            const result = file.match(regexp);
            if (result) {
                const version = result.groups.version || "";
                fileList.push({file, version});
            }
        })

        if (fileList.length !== 2) return

        const compare = this.utils.compareVersion(fileList[0].version, fileList[1].version);
        let deleteFile, remainFile;
        if (compare > 0) {
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