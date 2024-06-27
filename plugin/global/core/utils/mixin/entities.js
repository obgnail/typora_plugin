class entities {
    constructor(utils) {
        this.utils = utils;
        this.eWrite = document.querySelector("#write");
        this.eContent = document.querySelector("content");
        this.$eWrite = $("#write");
        this.$eContent = $("content");

        this.querySelectorAllInWrite = (...args) => this.eWrite.querySelectorAll(...args);
        this.querySelectorInWrite = (...args) => this.eWrite.querySelector(...args);
    }
}

module.exports = {
    entities
}