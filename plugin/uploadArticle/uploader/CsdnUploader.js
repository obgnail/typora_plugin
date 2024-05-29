const BaseUploaderInterface = require("./BaseUploaderInterface");

/**
 * 上传到CSDN的插件实现
 */
class CsdnUploader extends BaseUploaderInterface {
    getName() {
        return "csdn";
    }

    async upload(title, content, extraData) {
        return new Promise((resolve, reject) => {
            const https = require('https');
            const {marked} = require('marked');
            const Notification = require('../utils/customNotification.js').plugin;
            const notification = new Notification();

            let articleId = 0;
            const uuid = this.utils.generateUUID();
            const url = "https://bizapi.csdn.net/blog-console-api/v1/postedit/saveArticle";
            const signature = this.utils.getSign(uuid, url);
            const xCaKey = "203803574";

            const options = {
                hostname: 'bizapi.csdn.net',
                path: '/blog-console-api/v1/postedit/saveArticle',
                method: 'POST',
                headers: {
                    'accept': 'application/json, text/plain, */*',
                    'accept-language': 'zh-CN,zh;q=0.9',
                    'content-type': 'application/json;',
                    'cookie': this.config.upload.csdn.cookie,
                    'origin': 'https://mp.csdn.net',
                    'priority': 'u=1, i',
                    'referer': 'https://mp.csdn.net/mp_blog/creation/editor?not_checkout=1',
                    'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-site',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                    'x-ca-key': xCaKey,
                    'x-ca-nonce': uuid,
                    'x-ca-signature': signature,
                    'x-ca-signature-headers': 'x-ca-key,x-ca-nonce'
                }
            };

            const req = https.request(options, (res) => {
                const chunks = [];

                res.on('data', (chunk) => {
                    chunks.push(chunk);
                });

                res.on('end', () => {
                    const body = Buffer.concat(chunks);
                    try {
                        console.log(body.toString());
                        articleId = JSON.parse(body.toString()).data.article_id;

                        const uuid2 = this.utils.generateUUID();
                        const url2 = "https://bizapi.csdn.net/blog/phoenix/console/v1/history-version/save";
                        const signature2 = this.utils.getSign(uuid2, url2);

                        const options2 = {
                            hostname: 'bizapi.csdn.net',
                            path: '/blog/phoenix/console/v1/history-version/save',
                            method: 'POST',
                            headers: {
                                'accept': 'application/json, text/plain, */*',
                                'accept-language': 'zh-CN,zh;q=0.9',
                                'content-type': 'application/json;',
                                'cookie': this.config.upload.csdn.cookie,
                                'origin': 'https://mp.csdn.net',
                                'priority': 'u=1, i',
                                'referer': 'https://mp.csdn.net/mp_blog/creation/editor?not_checkout=1',
                                'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
                                'sec-ch-ua-mobile': '?0',
                                'sec-ch-ua-platform': '"Windows"',
                                'sec-fetch-dest': 'empty',
                                'sec-fetch-mode': 'cors',
                                'sec-fetch-site': 'same-site',
                                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                                'x-ca-key': xCaKey,
                                'x-ca-nonce': uuid2,
                                'x-ca-signature': signature2,
                                'x-ca-signature-headers': 'x-ca-key,x-ca-nonce'
                            }
                        };

                        const req2 = https.request(options2, (res) => {
                            const chunks2 = [];

                            res.on('data', (chunk) => {
                                chunks2.push(chunk);
                            });

                            res.on('end', () => {
                                const body2 = Buffer.concat(chunks2);
                                console.log(body2.toString());
                                resolve(body2);
                            });

                            res.on('error', (error) => {
                                console.error(error);
                                notification.showNotification("CSDN第二次请求失败", "error");
                                reject(error);
                            });
                        });

                        req2.write(JSON.stringify({
                            'articleId': articleId,
                            'title': title,
                            'content': marked(content),
                            'type': 3
                        }));
                        req2.end();
                    } catch (error) {
                        console.error(error);
                        notification.showNotification("CSDN读取返回数据失败", "error");
                        reject(error);
                    }
                });

                res.on('error', (error) => {
                    console.error(error);
                    notification.showNotification("CSDN第一次请求失败", "error");
                    reject(error);
                });
            });

            req.write(JSON.stringify({
                'article_id': '',
                'title': title,
                'description': '',
                'content': marked(content),
                'tags': 'eclipse',
                'categories': '',
                'type': 'original',
                'status': 0,
                'read_type': 'public',
                'reason': '',
                'original_link': '',
                'authorized_status': false,
                'check_original': false,
                'source': 'pc_postedit',
                'not_auto_saved': 1,
                'creator_activity_id': '',
                'cover_images': [],
                'cover_type': 1,
                'vote_id': 0,
                'resource_id': '',
                'scheduled_time': 0,
                'is_new': 1
            }));
            req.end();
        });
    }
}

module.exports = CsdnUploader;
