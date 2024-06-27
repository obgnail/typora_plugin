class entities {
    constructor(utils) {
        this.utils = utils;
        this.eWrite = document.querySelector("#write");
        this.eContent = document.querySelector("content");
        this.$eWrite = $("#write");
        this.$eContent = $("content");
    }
}

module.exports = {
    entities
}