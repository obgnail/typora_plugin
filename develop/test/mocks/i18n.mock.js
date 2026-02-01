const { mock } = require("node:test")

const i18nMock = {
    locale: "en",
    data: {},
    init: mock.fn(async (locale) => {
        i18nMock.locale = locale || "en"
        return Promise.resolve()
    }),
    t: mock.fn((field, key, variables) => {
        return variables
            ? `${key} ${JSON.stringify(variables)}`
            : key
    }),
    link: mock.fn((parts) => parts.join(" ")),
    array: mock.fn((field, keys, prefix = "") => {
        return keys.map(k => `${prefix}${k}`)
    }),
    entries: mock.fn((field, keys, prefix = "") => {
        return Object.fromEntries(keys.map(k => [k, `${prefix}${k}`]))
    }),
    bind: mock.fn((field) => ({
        locale: i18nMock.locale,
        data: {},
        link: i18nMock.link,
        _t: i18nMock.t,
        t: (key, variables) => i18nMock.t(field, key, variables),
        array: (keys, prefix) => i18nMock.array(field, keys, prefix),
        entries: (keys, prefix) => i18nMock.entries(field, keys, prefix),
        fillActions: (actions, prefix = "act.") => {
            return actions.map(act => {
                if (!act.act_name && act.act_value) {
                    act.act_name = `${prefix}${act.act_value}`
                }
                return act
            })
        },
    }))
}

module.exports = i18nMock
