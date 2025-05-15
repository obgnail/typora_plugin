const CryptoJS = require("crypto-js")

const encrypt = (text, key) => {
    const k = CryptoJS.enc.Base64.parse(key)
    const t = CryptoJS.enc.Utf8.parse(text)
    const r = CryptoJS.AES.encrypt(t, k, { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 })
    return r.toString()
}

const decrypt = (text, key) => {
    const k = CryptoJS.enc.Base64.parse(key)
    const r = CryptoJS.AES.decrypt(text, k, { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 })
    return CryptoJS.enc.Utf8.stringify(r)
}

module.exports = { encrypt, decrypt }
