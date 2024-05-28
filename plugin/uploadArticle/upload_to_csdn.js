const upload = require("./uploadUtil");

class uploadToCSDN extends upload {
    hotkey = () => [{hotkey: this.config.HOTKEY, callback: this.call}]


    call = () => {
        let filePath = this.utils.getFilePath();
        this.uploadProxy(filePath, "csdn");
    }
}


module.exports = {
    plugin: uploadToCSDN
};