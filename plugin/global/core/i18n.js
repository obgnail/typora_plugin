const normalizeLocale = (locale) => {
    if (locale === "auto") {
        locale = window._options.userLocale
    }
    switch (locale) {
        case "zh-CN":
        case "zh-Hans":
            return "zh-CN"
        case "zh-TW":
        case "zh-Hant":
            return "zh-TW"
        // case "ko":
        // case "ko-KR":
        //     return "ko"
        // case "ja":
        // case "ja-JP":
        //     return "ja"
        case "Base":
        case "en-US":
        case "en-BG":
        case "en":
        default:
            return "en"
    }
}

const noSpaceLanguages = ["zh-CN", "zh-TW"]

const i18n = {
    locale: "",
    data: {},
    init: async (locale) => {
        const normalized = normalizeLocale(locale)
        const path = require("path")
        const file = path.join(path.dirname(__dirname), "locales", `${normalized}.json`)
        const json = await require("fs").promises.readFile(file, "utf8")
        i18n.data = JSON.parse(json)
        i18n.locale = normalized
    },
    t: (field, key, variables) => {
        let text = i18n.data[field]?.[key]
        if (text === undefined) {
            return key
        }
        if (variables && typeof text === "string") {
            text = text.replace(/{{\s*(\w+)\s*}}/g, (match, varKey) => variables[varKey] ?? match)
        }
        return text
    },
    link: (parts) => {
        const joiner = noSpaceLanguages.includes(i18n.locale) ? "" : " "
        return parts.join(joiner)
    },
    array: (field, keys, prefix = "") => {
        return keys.map(k => i18n.t(field, prefix + k))
    },
    entries: (field, keys, prefix = "") => {
        return Object.fromEntries(keys.map(k => [k, i18n.t(field, prefix + k)]))
    },
    bind: (field) => ({
        data: i18n.data[field],
        link: i18n.link,
        _t: i18n.t,
        t: (key, variables) => i18n.t(field, key, variables),
        array: (keys, prefix) => i18n.array(field, keys, prefix),
        entries: (keys, prefix) => i18n.entries(field, keys, prefix),
        fillActions: (actions) => {
            for (const act of actions) {
                if (!act.act_name && act.act_value) {
                    act.act_name = i18n.t(field, `act.${act.act_value}`)
                }
            }
            return actions
        },
    })
}

module.exports = i18n
