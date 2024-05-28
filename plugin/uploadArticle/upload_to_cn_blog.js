const upload = require("./uploadUtil");

class uploadToCNBlogPlugin extends upload {

    hotkey = () => [{hotkey: this.config.HOTKEY, callback: this.call}]


    call = () => {
        let filePath = this.utils.getFilePath();
        this.uploadProxy(filePath, "cnblog");
    }

}

module.exports = {
    plugin: uploadToCNBlogPlugin
};