class Entities {
    constructor(utils) {
        this.utils = utils;
        this.eWrite = document.querySelector("#write");
        this.eContent = document.querySelector("content");
        this.$eWrite = $(this.eWrite);
        this.$eContent = $(this.eContent);

        this.querySelectorAllInWrite = (...args) => this.eWrite.querySelectorAll(...args);
        this.querySelectorInWrite = (...args) => this.eWrite.querySelector(...args);
    }
}

module.exports = Entities
