const upload = require("./uploadUtil");

class uploadToAllPlatform extends upload {

    hotkey = () => [{hotkey: this.config.HOTKEY, callback: this.call}]


    call = () => {
        let filePath = this.utils.getFilePath();
        this.uploadProxy(filePath);
    }

}

module.exports = {
    plugin: uploadToAllPlatform
};