class polyfill {
    constructor(utils) {
        this.utils = utils;
    }

    process = () => {
        this.array()
        this.object()
    }

    array = () => {
        if (!Array.prototype.at) {
            Array.prototype.at = function (index) {
                const len = this.length
                if (index < 0) {
                    index = len + index
                }
                if (index >= len || index < 0) {
                    return undefined
                }
                return this[index]
            }
        }
    }

    object = () => {
        // try not to use it
        if (this.utils.isBetaVersion) {
            Object.defineProperty(Object.prototype, "?.", {
                value: function (prop) {
                    return this == null ? undefined : this[prop]
                },
                writable: false,
                enumerable: false,
                configurable: true
            })
        }
    }
}

module.exports = {
    polyfill
}
