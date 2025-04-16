function At() {
    function at(n) {
        n = Math.trunc(n) || 0
        if (n < 0) {
            n += this.length
        }
        if (n < 0 || n >= this.length) {
            return undefined
        }
        return this[n]
    }
    const TypedArray = Reflect.getPrototypeOf(Int8Array)
    for (const type of [Array, String, TypedArray]) {
        if (!type.prototype.at) {
            Object.defineProperty(type.prototype, "at", {
                value: at,
                writable: true,
                enumerable: false,
                configurable: true
            })
        }
    }
}

function HasOwn() {
    if (!Object.hasOwn) {
        Object.defineProperty(Object, "hasOwn", {
            value(object, key) {
                return Object.prototype.hasOwnProperty.call(object, key)
            },
            configurable: true,
            enumerable: false,
            writable: true,
        })
    }
}

function polyfill() {
    At()
    HasOwn()
}

module.exports = {
    polyfill
}
