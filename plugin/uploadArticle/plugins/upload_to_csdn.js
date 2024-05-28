const UploadUtil = require("../Plugin2UploadBridge");

class uploadToCSDN extends BasePlugin {
    hotkey = () => [{hotkey: this.config.HOTKEY, callback: this.call}]


    call = () => {
        this.baseUploader = new UploadUtil(this);
        let filePath = this.utils.getFilePath();
        this.baseUploader.uploadProxy(filePath, "csdn");
    }
}


module.exports = {
    plugin: uploadToCSDN
};