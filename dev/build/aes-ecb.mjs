import AES from "crypto-js/aes"
import Utf8 from "crypto-js/enc-utf8"
import Base64 from "crypto-js/enc-base64"
import ECB from "crypto-js/mode-ecb"
import Pkcs7 from "crypto-js/pad-pkcs7"

const encrypt = (text, key) => {
    const k = Base64.parse(key)
    const t = Utf8.parse(text)
    const r = AES.encrypt(t, k, { mode: ECB, padding: Pkcs7 })
    return r.toString()
}

const decrypt = (text, key) => {
    const k = Base64.parse(key)
    const r = AES.decrypt(text, k, { mode: ECB, padding: Pkcs7 })
    return Utf8.stringify(r)
}

export { encrypt, decrypt }
