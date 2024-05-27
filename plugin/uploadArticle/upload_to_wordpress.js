const upload = require("./uploadUtil");

class uploadToWordPress extends upload {

    hotkey = () => [{hotkey: this.config.HOTKEY, callback: this.call}]


    call = () => {
        let filePath = this.utils.getFilePath();
        this.upload(filePath, "wordpress");
    }
}


module.exports = {
    plugin: uploadToWordPress
};