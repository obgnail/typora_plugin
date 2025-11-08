const getUserLocale = (lang) => {
    if (lang === "auto") {
        lang = window._options.userLocale
    }
    switch (lang) {
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

const i18n = {
    locale: "",
    data: {},
    init: async function (locale) {
        try {
            locale = getUserLocale(locale)
            const path = require("path")
            const file = path.join(path.dirname(__dirname), "locales", `${locale}.json`)
            const json = await require("fs").promises.readFile(file, "utf8")
            this.data = JSON.parse(json)
            this.locale = locale
        } catch (error) {
            console.error("Could not load translations:", error)
        }
    },
    t: function (field, key, variables) {
        const field_ = i18n.data[field]
        if (field_ === undefined) {
            return key
        }
        let text = field_[key]
        if (text === undefined) {
            return key
        }
        if (variables) {
            for (const [k, v] of Object.entries(variables)) {
                const placeholder = new RegExp(`{{${k}}}`, "g")
                text = text.replace(placeholder, v)
            }
        }
        return text
    },
    link: function (parts) {
        return parts.join(i18n.locale.startsWith("zh") ? "" : " ")
    },
    array: function (field, keys, prefix = "") {
        return keys.map(k => i18n.t(field, prefix + k))
    },
    entries: function (field, keys, prefix = "") {
        return Object.fromEntries(keys.map(k => [k, i18n.t(field, prefix + k)]))
    },
    bind: function (field) {
        return {
            noConflict: i18n,
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
        }
    }
}

module.exports = i18n
