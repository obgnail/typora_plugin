const sentinel = Symbol()

const utils = {
    debounce: (fn, delay = 500) => {
        let timer
        return function (...args) {
            clearTimeout(timer)
            timer = setTimeout(() => fn(...args), delay)
        }
    },
    once: (fn) => {
        let cache = sentinel
        return function (...args) {
            if (cache === sentinel) {
                cache = fn(...args)
            }
            return cache
        }
    },
}

module.exports = utils
