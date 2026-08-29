const BaseUploader = require("../base")

class CsdnUploader extends BaseUploader {
  getName() {
    return "csdn"
  }

  async requestPromise(options, postData) {
    const https = require("https")
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        const chunks = []
        res.on("data", chunk => chunks.push(chunk))
        res.on("end", () => resolve(Buffer.concat(chunks).toString()))
        res.on("error", reject)
      })
      req.on("error", reject)
      if (postData) {
        req.write(postData)
      }
      req.end()
    })
  }

  async upload(title, content, extraData) {
    const { marked } = require("marked")

    const uuid1 = this.plugin.utils.getUUID()
    const url1 = "https://bizapi.csdn.net/blog-console-api/v1/postedit/saveArticle"
    const signature1 = generateSignature(uuid1, url1)
    const xCaKey = "203803574"

    const baseHeaders = {
      "accept": "application/json, text/plain, */*",
      "accept-language": "zh-CN,zh;q=0.9",
      "content-type": "application/json;",
      "cookie": this.config.upload.csdn.cookie,
      "origin": "https://mp.csdn.net",
      "priority": "u=1, i",
      "referer": "https://mp.csdn.net/mp_blog/creation/editor?not_checkout=1",
      "sec-ch-ua": "\"Google Chrome\";v=\"125\", \"Chromium\";v=\"125\", \"Not.A/Brand\";v=\"24\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Windows\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "x-ca-key": xCaKey,
    }

    const payload1 = JSON.stringify({
      "article_id": "",
      "title": title,
      "description": "",
      "content": marked(content),
      "tags": "eclipse",
      "categories": "",
      "type": "original",
      "status": 0,
      "read_type": "public",
      "reason": "",
      "original_link": "",
      "authorized_status": false,
      "check_original": false,
      "source": "pc_postedit",
      "not_auto_saved": 1,
      "creator_activity_id": "",
      "cover_images": [],
      "cover_type": 1,
      "vote_id": 0,
      "resource_id": "",
      "scheduled_time": 0,
      "is_new": 1,
    })

    let response1
    try {
      response1 = await this.requestPromise({
        hostname: "bizapi.csdn.net",
        path: "/blog-console-api/v1/postedit/saveArticle",
        method: "POST",
        headers: {
          ...baseHeaders,
          "x-ca-nonce": uuid1,
          "x-ca-signature": signature1,
          "x-ca-signature-headers": "x-ca-key,x-ca-nonce",
        },
      }, payload1)
    } catch (e) {
      throw new Error(`First API request failed: ${e.message}`)
    }

    let articleId = 0
    try {
      const bodyObj = JSON.parse(response1)
      articleId = bodyObj.data.article_id
    } catch (e) {
      throw new Error(`Failed to parse first response payload: ${response1}`)
    }

    const uuid2 = this.plugin.utils.getUUID()
    const url2 = "https://bizapi.csdn.net/blog/phoenix/console/v1/history-version/save"
    const signature2 = generateSignature(uuid2, url2)

    const payload2 = JSON.stringify({
      "articleId": articleId,
      "title": title,
      "content": marked(content),
      "type": 3,
    })

    try {
      await this.requestPromise({
        hostname: "bizapi.csdn.net",
        path: "/blog/phoenix/console/v1/history-version/save",
        method: "POST",
        headers: {
          ...baseHeaders,
          "x-ca-nonce": uuid2,
          "x-ca-signature": signature2,
          "x-ca-signature-headers": "x-ca-key,x-ca-nonce",
        },
      }, payload2)
    } catch (e) {
      throw new Error(`Second API request (history version) failed: ${e.message}`)
    }
  }
}

const generateSignature = (uuid, url) => {
  const ekey = process.env.ALIBABA_CLOUD_EKEY
  const xCaKey = process.env.ALIBABA_CLOUD_XCA_KEY
  if (!ekey || !xCaKey) {
    throw new Error("Missing Alibaba Cloud credentials. Set ALIBABA_CLOUD_EKEY and ALIBABA_CLOUD_XCA_KEY environment variables.")
  }

  const CryptoJS = require("./crypto-js/core")
  require("./crypto-js/hmac")
  require("./crypto-js/sha256")
  require("./crypto-js/enc-base64")

  const _url = new URL(url).pathname
  const toEnc = `POST\napplication/json, text/plain, */*\n\napplication/json;\n\nx-ca-key:${xCaKey}\nx-ca-nonce:${uuid}\n${_url}`
  const hmac = CryptoJS.HmacSHA256(toEnc, ekey)
  return CryptoJS.enc.Base64.stringify(hmac)
}

module.exports = CsdnUploader
