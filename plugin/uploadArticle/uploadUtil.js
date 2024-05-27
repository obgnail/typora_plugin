/*
* 目前支持三种平台：
*   1：CSDN
*   2：博客园
*   3：wordpress
* 以后会支持的平台：
*    vitepress
*    hexo
*    简书
*    微信公众号
*    自建博客
* 未来会支持的特性：
*   定时发布
*   延时发布
*   设置标签、分类、封面图
* 未来不会支持的：
*    批量发布（批量发布容易被风控，且这个应该是一次性脚本做的事情）
*    知乎（我真的尽力了，逆向+selenium自动化+过滑块，没一个能过这狗知乎的）
* */

const Notification = require('./customNotification.js').plugin;

// 本地包
const axios = require('./axios.min.js');
const yaml = require('../global/utils/yaml');
// 引入 crypto-js 库
const CryptoJS = require('./crypto-js/core');
require('./crypto-js/hmac');
require('./crypto-js/sha256');
require('./crypto-js/enc-base64'); // 引入 Base64 编码模块

// node包
const {URL} = require('url');
const fs = require('fs');
const https = require('https');

// 外部包 marked、selenium
// https://juejin.cn/post/7227603054631600187
const {marked} = require('marked'); // md2html，可以配合其他插件支持mermaid这些原本在wp原生不支持的语法
// selenium相关配置
const {Builder, By, Key, until} = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
require('chromedriver');
// 配置无头模式的 Chrome 浏览器选项
let options = new chrome.Options();
options.addArguments(
    '--disable-blink-features=AutomationControlled', // 隐藏webdriver属性
    '--disable-infobars', // 隐藏自动化提示信息
    '--disable-extensions', // 禁用扩展
    '--disable-gpu', // 禁用GPU
    '--no-sandbox', // 以非沙盒模式运行
    '--disable-dev-shm-usage', // 防止共享内存使用过高
    '--disable-javascript',  // 禁用js
    '--headless' // 启用无头模式
);

SELENIUM_WAIT_FIX_TIME_LEVEL1 = 2000; // 设置一级固定等待时间2s
SELENIUM_WAIT_FIX_TIME_LEVEL2 = 5000; // 设置二级固定等待时间5s
SELENIUM_EXPLICIT_WAIT_TIME = 10000; // 设置显式等待时间为10秒

const notification = new Notification();    // 实例化弹窗对象


class uploadUtil extends BasePlugin {
    // 初始化读取配置信息
    init = () => {
        const filePath = this.utils.Package.Path.resolve(__dirname, '../global/settings/uploadConfig.yaml');
        try {
            const fileContents = fs.readFileSync(filePath, 'utf8');

            const data = yaml.load(fileContents);

            this.wordpressHostname = data.upload.wordpress.hostname
            this.wordpressLoginUrl = data.upload.wordpress.loginUrl;
            this.wordpressUsername = data.upload.wordpress.username;
            this.wordpressPassword = data.upload.wordpress.password;
            this.cnblogUsername = data.upload.cnblog.username;
            this.cnblogPassword = data.upload.cnblog.password;
            this.csdnCookie = data.upload.csdn.cookie;
            this.csdnEnabled = data.upload.csdn.enabled;
            this.cnblogEnabled = data.upload.cnblog.enabled;
            this.wordpressEnabled = data.upload.wordpress.enabled;

        } catch (e) {
            console.log(e);
            notification.showNotification("配置文件读取发生异常", "error")
        }
    }

    /**
     * 处理文件内容
     * @param filePath 当前文档绝对路径
     * @returns {{extraData: string, title: string, content: string}}     解析出的文件信息
     */
    readAndSplitFile = (filePath) => {
        try {
            const data = fs.readFileSync(filePath, 'utf-8');
            // 按行切分数据
            const lines = data.split('\n');
            // 获取第一行作为标题
            const title = lines[0].trim().replace(/#/g, '').trim();
            // 获取剩余行作为内容
            const content = lines.slice(1).join('\n').trim();
            if (title === "" || content === '') {
                throw new Error("内容为空")
            }
            const extraData = ""  // todo: 取出标签，分类，封面图等
            return {title, content, extraData};
        } catch (error) {
            notification.showNotification("当前文章读取发生异常", "error");
            console.error('Error reading file:', error);
        }
    }

    /**
     * 上传到所有平台
     * @param filePath  当前文档绝对路径
     * @returns {Promise<void>}
     */
    uploadAll = async (filePath) => {
        notification.showNotification('开始上传，请不要关闭软件', 'info');
        // 记录上传开始时间
        const startTime = new Date();
        // 1：读取数据
        let {title, content, extraData} = this.readAndSplitFile(filePath);
        // 2：开始上传
        if (this.wordpressEnabled) {
            await this._uploadToWordPress(title, content, extraData)
        }
        if (this.cnblogEnabled) {
            await this._uploadToCNBlog(title, content, extraData);
        }
        if (this.csdnEnabled) {
            await this._uploadToCSDN(title, content, extraData);
        }
        // 记录上传结束时间
        const endTime = new Date();
        const duration = ((endTime - startTime) / 1000).toFixed(1); // 计算花费的秒数

        // 3：上传成功的提示
        notification.showNotification(`所有平台上传成功，耗时${duration}秒`, 'success');
    }

    /**
     * 阉割版策略模式+模版方法
     * @param filePath  当前文档绝对路径
     * @param type  平台类型
     */
    upload = async (filePath, type) => {
        notification.showNotification('开始上传，请不要关闭软件', 'info');
        // 记录上传开始时间
        const startTime = new Date();

        // 1：读取数据
        let {title, content, extraData} = this.readAndSplitFile(filePath);
        // 2：开始上传
        if (type === 'csdn') {
            await this._uploadToCSDN(title, content, extraData);
        } else if (type === 'wordpress') {
            await this._uploadToWordPress(title, content, extraData);
        } else if (type === 'cnblog') {
            await this._uploadToCNBlog(title, content, extraData);
        } else {
            throw new Error("不支持的类型")
        }

        // 记录上传结束时间
        const endTime = new Date();
        const duration = ((endTime - startTime) / 1000).toFixed(1); // 计算花费的秒数
        // 上传成功的提示
        notification.showNotification(`${type}上传成功，花费时间: ${duration} 秒`, 'success');
    }

    /**
     * 获取CSDN加密参数 x-ca-signature（仅POST请求）
     * @param uuid 随机生成的uuid
     * @param url 访问的URL
     * @returns {*|string|string} 加密参数的16进制值
     */
    getSign = (uuid, url) => {
        const parsedUrl = new URL(url);
        const _url = parsedUrl.pathname;

        const ekey = "9znpamsyl2c7cdrr9sas0le9vbc3r6ba";
        const xCaKey = "203803574"
        const toEnc = `POST\napplication/json, text/plain, */*\n\napplication/json;\n\nx-ca-key:${xCaKey}\nx-ca-nonce:${uuid}\n${_url}`;
        const hmac = CryptoJS.HmacSHA256(toEnc, ekey);
        return CryptoJS.enc.Base64.stringify(hmac);
    }

    /**
     * 生成一个随机的uuid
     * @returns {string} 生成的随机uuid字符串值
     */
    generateUUID = () => {
        // https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * 上传到CSDN
     * @param title 文章标题
     * @param content 文章内容
     * @param extraData 额外数据，包含tags、categories、type,cover_url
     * 待扩展：tags、categories，type,cover_url
     */
    _uploadToCSDN = (title, content, extraData) => {

        return new Promise((resolve, reject) => {
            let articleId = 0;  // 第二次发送请求的文章id

            const uuid = this.generateUUID();
            const url = "https://bizapi.csdn.net/blog-console-api/v1/postedit/saveArticle";
            const signature = this.getSign(uuid, url);
            const xCaKey = "203803574"

            const options = {
                hostname: 'bizapi.csdn.net',
                path: '/blog-console-api/v1/postedit/saveArticle',
                method: 'POST',
                headers: {
                    'accept': 'application/json, text/plain, */*',
                    'accept-language': 'zh-CN,zh;q=0.9',
                    'content-type': 'application/json;',
                    'cookie': this.csdnCookie,
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

                        // 开始构造第二次请求，虽然我也不知道他为什么要发，按道理是服务端开个mq去做
                        const uuid2 = this.generateUUID();
                        const url2 = "https://bizapi.csdn.net/blog/phoenix/console/v1/history-version/save";
                        const signature2 = this.getSign(uuid2, url2);

                        const options2 = {
                            hostname: 'bizapi.csdn.net',
                            path: '/blog/phoenix/console/v1/history-version/save',
                            method: 'POST',
                            headers: {
                                'accept': 'application/json, text/plain, */*',
                                'accept-language': 'zh-CN,zh;q=0.9',
                                'content-type': 'application/json;',
                                'cookie': this.csdnCookie,
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
                                notification.showNotification("CSDN第二次请求失败", "error")
                                reject(error); // 第二次请求失败，拒绝 Promise
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
                        notification.showNotification("CSDN读取返回数据失败", "error")
                        reject(error); // 解析 JSON或读取数据失败，拒绝 Promise
                    }
                });

                res.on('error', (error) => {
                    console.error(error);
                    notification.showNotification("CSDN第一次请求失败", "error")
                    reject(error); // 第一次请求失败，拒绝 Promise
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


    /**
     * 第三方打码平台——滑块类（没有用到，token用的话重新设置！，我用的云码：https://www.jfbym.com/）
     * @param sliderBase64  图片base64字符串
     * @returns {Promise<number>}   滑块正确的像素值
     */
    getPosition = async (sliderBase64) => {
        var data = JSON.stringify({
            "token": "nderhFB9H0-ILghtL4FMe4LLg9DefN7iNAtNdSmzz",
            "type": "22222",
            "image": sliderBase64
        });
        var config = {
            method: 'post',
            url: 'http://api.jfbym.com/api/YmServer/customApi',
            headers: {
                'Content-Type': 'application/json'
            },
            data: data
        };
        try {
            const response = await axios(config);
            console.log(response.data.data)
            return parseInt(response.data.data.data, 10); // 确保返回的是整数
        } catch (error) {
            console.error(error);
            return 178; // 发生错误时返回默认值
        }
    }


    /**
     * 上传到 WordPress
     * @param title 文章标题
     * @param content 文章内容
     * @param extraData 额外信息，标签、分类、封面图等
     * @returns {Promise<void>}
     */
    _uploadToWordPress = async (title, content, extraData) => {
        // 初始化 WebDriver
        let driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
        try {
            await driver.manage().window().maximize();  // 全屏，调试时候舒服点
            // 打开wp登录页面
            await driver.get(this.wordpressLoginUrl);

            await driver.sleep(SELENIUM_WAIT_FIX_TIME_LEVEL1)    // 必须等待几秒，否则无法定位元素
            // 等待页面有且可见时输入用户名
            let userInput = await driver.wait(until.elementLocated(By.id('user_login')),);
            await driver.wait(until.elementIsVisible(userInput), SELENIUM_EXPLICIT_WAIT_TIME);
            await userInput.sendKeys(this.wordpressUsername);
            // 等待页面有且可见时输入密码
            let passInput = await driver.wait(until.elementLocated(By.id('user_pass')), SELENIUM_EXPLICIT_WAIT_TIME);
            await driver.wait(until.elementIsVisible(passInput), SELENIUM_EXPLICIT_WAIT_TIME);
            await passInput.sendKeys(this.wordpressPassword, Key.RETURN);
            // 去到发表文章页面
            await driver.get(`${this.wordpressHostname}/wp-admin/post-new.php`);

            // 等待并输入标题（name为post_title）
            await driver.wait(until.elementLocated(By.name('post_title')), SELENIUM_EXPLICIT_WAIT_TIME);
            let titleField = await driver.findElement(By.name('post_title'));
            await titleField.sendKeys(title);

            // 等待并输入文章内容，需要注意富文本编辑器一般都是iframe，这个时候要先进去才能设置值
            await driver.wait(until.elementLocated(By.id('content_ifr')), SELENIUM_EXPLICIT_WAIT_TIME);
            let editorFrame = await driver.findElement(By.id('content_ifr'));
            await driver.switchTo().frame(editorFrame);

            // 将HTML内容插入到富文本编辑器
            let body = await driver.findElement(By.id('tinymce'));
            await driver.executeScript("arguments[0].innerHTML = arguments[1]", body, marked(content));

            // 切换回主文档
            await driver.switchTo().defaultContent();

            await driver.sleep(SELENIUM_WAIT_FIX_TIME_LEVEL1)    // 等待几秒，防止文章内容太多浏览器没反应过来

            await driver.wait(until.elementLocated(By.id('publish')), SELENIUM_EXPLICIT_WAIT_TIME);
            let publishButton = await driver.findElement(By.id('publish'));
            await publishButton.click();

            // 流程是走完了，但是其实有时候不能确定发布成功，这个后续校验完善一点
            // 比如用户content为""，这个时候点击发布按钮会提示让你输入内容，但是并不会抛出异常
            console.log("wordpress博客发布流程已完毕")
            notification.showNotification("WordPress博客发布流程已完毕", "success");
            // 添加无限等待，使浏览器保持打开状态，调试使用
            // await new Promise(resolve => setTimeout(resolve, 99999999));
        } catch (error) {
            console.log(error)
            notification.showNotification('WordPress博客发布失败', 'error')
        } finally {
            // 关闭浏览器
            await driver.quit();
        }
    }

    /**
     * 上传到博客园
     * @param title 文章标题
     * @param content   文章内容
     * @param extraData 额外信息，标签、分类、封面图等
     * @returns {Promise<void>}
     */
    _uploadToCNBlog = async (title, content, extraData) => {

        // 初始化 WebDriver
        let driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
        try {
            await driver.manage().window().maximize();  // 最大化浏览器窗口，调试时候舒服点
            // 打开博客园登录网站
            await driver.get('https://account.cnblogs.com/signin?returnUrl=https:%2F%2Fwww.cnblogs.com%2F');
            // 输入用户名
            await driver.findElement(By.css('input[formcontrolname="username"]')).sendKeys(this.cnblogUsername);
            // 输入密码
            await driver.findElement(By.css('input[formcontrolname="password"]')).sendKeys(this.cnblogPassword, Key.RETURN);
            // 点击登录按钮
            await driver.findElement(By.css("button.mat-flat-button.mat-primary")).click();

            // 点击智能验证按钮（这个确实没有难度，只是一个最基本的检测，稍微隐藏一下就过了）
            await driver.findElement(By.id("SM_TXT_1"));
            // 等待并滚动到智能验证按钮位置
            let verificationButton = await driver.findElement(By.id("SM_TXT_1"));
            await driver.wait(until.elementIsVisible(verificationButton), 10000);
            await driver.executeScript("arguments[0].scrollIntoView(true);", verificationButton);

            // 通过执行 JavaScript 代码隐藏 WebDriver 属性
            await driver.executeScript("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})");
            // 伪造用户代理
            await driver.executeScript("Object.defineProperty(navigator, 'userAgent', {get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'})");

            // 通过 JavaScript 点击智能验证按钮
            await driver.executeScript("arguments[0].click();", verificationButton);


            // 等待固定时间，让编辑按钮加载一下
            await driver.sleep(SELENIUM_WAIT_FIX_TIME_LEVEL2);

            // 等待并点击发送文章按钮
            let postArticleButton = await driver.findElement(By.css('a.navbar-user-info.navbar-blog'));
            await driver.wait(until.elementIsVisible(postArticleButton), SELENIUM_EXPLICIT_WAIT_TIME);
            await driver.executeScript("arguments[0].scrollIntoView(true);", postArticleButton);
            await driver.executeScript("arguments[0].click();", postArticleButton);


            // 等待title和content输入框加载
            await driver.wait(until.elementLocated(By.id('post-title')), SELENIUM_EXPLICIT_WAIT_TIME);
            await driver.wait(until.elementLocated(By.id('md-editor')), SELENIUM_EXPLICIT_WAIT_TIME);

            // 填充title和content
            await driver.findElement(By.id('post-title')).sendKeys(title);

            // 他这个富文本编辑器应该是自己封装的，操作就很迷惑，我根本进去iframe刚赋值内容就没了，可能有其他逻辑，因此填充他的textarea
            /* // 点击“预览”按钮以显示预览iframe
             let previewButton = await driver.wait(until.elementLocated(By.css('.tab[title="预览(ctrl+shift+p)"]')), 10000);
             await previewButton.click();

             // 切换到预览的iframe
             let iframe = await driver.wait(until.elementLocated(By.css('iframe.preview-content')), 10000);
             await driver.switchTo().frame(iframe);
             console.log(marked(content))

             // 更新iframe中的内容
             let body = await driver.findElement(By.css('body'));
             await driver.executeScript("arguments[0].innerHTML = arguments[1]", body, marked(content));
             // 切换回主文档
             await driver.switchTo().defaultContent();*/

            // https://stackoverflow.com/questions/59138825/chromedriver-only-supports-characters-in-the-bmp-error-while-sending-emoji-with
            // 找到textarea并插入Markdown内容，注意，要执行脚本，sendKeys会报错，具体看上面stackoverflow的链接
            let editor = await driver.wait(until.elementLocated(By.id('md-editor')), SELENIUM_EXPLICIT_WAIT_TIME);
            await driver.wait(until.elementIsVisible(editor), SELENIUM_EXPLICIT_WAIT_TIME);

            // 使用executeScript来插入内容并触发change事件
            const jsCode = `
        var elm = arguments[0], txt = arguments[1];
        elm.value = txt;
        elm.dispatchEvent(new Event('input'));
        elm.dispatchEvent(new Event('change'));
        `;
            await driver.executeScript(jsCode, editor, content);


            await driver.sleep(SELENIUM_WAIT_FIX_TIME_LEVEL1); // 睡个两秒，防止浏览器没反应过来


            // 等待页面加载并查找发布按钮
            let publishButton = await driver.findElement(By.css('button[data-el-locator="publishBtn"]'));
            await driver.wait(until.elementIsVisible(publishButton), SELENIUM_EXPLICIT_WAIT_TIME);

            // 点击发布按钮
            await publishButton.click();

            notification.showNotification("博客园博客发布流程已完毕", "success");
            console.log("博客园博客发布流程已完毕")

        } catch (e) {
            notification.showNotification("博客园发布博客失败", "error");
            console.log(e)
        } finally {
            // 关闭浏览器
            await driver.quit();
        }


    }


    /**
     * 最恶心的一个知乎狗！！！我就自动登录一下，真让我蹭蹭啊不让进去啊。目前止步于过易盾的滑块，没专门研究过，不知道咋绕过
     * @param title     文章标题
     * @param content   文章内容
     * @param extraData 额外数据
     * @returns {Promise<void>}
     * @private
     */
    _uploadToZhiHu = async (title, content, extraData) => {
        let driver = await new Builder().forBrowser('chrome').build();
        try {
            await driver.manage().window().maximize();
            // 打开目标网站
            await driver.get('https://www.zhihu.com/signin?next=%2F');


            // 等待并点击“密码登录”选项卡
            let passwordLoginTab = await driver.wait(until.elementLocated(By.xpath("//div[contains(text(), '密码登录')]")), 10000);
            await passwordLoginTab.click();

            // 填充用户名和密码，点击登录
            // 等待并定位用户名输入框
            let usernameInput = await driver.wait(until.elementLocated(By.name('username')), SELENIUM_EXPLICIT_WAIT_TIME);

            await usernameInput.sendKeys('');

            // 等待并定位用户名输入框
            let passwordInput = await driver.wait(until.elementLocated(By.name('password')), SELENIUM_EXPLICIT_WAIT_TIME);

            await passwordInput.sendKeys('');

            await driver.sleep(SELENIUM_WAIT_FIX_TIME_LEVEL1)   // 等两秒再按回车
            await passwordInput.sendKeys(Key.RETURN);


            // 等待滑块验证码出现
            let sliderModal = await driver.wait(until.elementLocated(By.css('.yidun_modal')), SELENIUM_EXPLICIT_WAIT_TIME);


            // 伪造用户代理（然而没用）
            await driver.executeScript("Object.defineProperty(navigator, 'userAgent', {get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'})");
            await driver.executeScript("Object.defineProperty(navigator, 'webdriver', { get: () => undefined })");
            await driver.executeScript("Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })");
            await driver.executeScript("Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })");
            await driver.sleep(SELENIUM_WAIT_FIX_TIME_LEVEL1)   // 遇事不决，睡两秒

            // 获取滑块的截图并转换为Base64
            let sliderScreenshot = await sliderModal.takeScreenshot(true);
            let sliderBase64 = sliderScreenshot.toString('base64');
            const dis = await this.getPosition(sliderBase64);
            // fs.writeFileSync('slider.png', sliderScreenshot, 'base64');


            // 获取小滑块元素
            let smallImage = await driver.wait(until.elementLocated(By.css('.yidun_slider')), 10000);
            let smallImageRect = await smallImage.getRect();

            // 获取滑块背景图的宽度
            let bgImage = await driver.wait(until.elementLocated(By.css('.yidun_bg-img')), 10000);
            let bgImageRect = await bgImage.getRect();
            let bgImageNaturalWidth = await driver.executeScript("return arguments[0].naturalWidth;", bgImage);


            // 按下小滑块按钮不动
            let action = driver.actions({bridge: true});
            await action.move({origin: smallImage}).press().perform();


            // 移动小滑块，模拟人的操作，一次次移动一点点
            let moved = 0;
            while (moved < dis / 4) {
                let x = Math.floor(Math.random() * (10 - 3 + 1) + 3); // 每次移动3到10像素
                moved += x;
                if (moved > dis) {
                    x -= (moved - dis); // 调整最后一次移动的距离，确保滑块不会超过目标位置
                    moved = dis;
                }
                await action.move({origin: smallImage, x, y: 0}).perform();
                console.log(`已移动: ${moved}px`);
                await driver.sleep(Math.floor(Math.random() * (150 - 50 + 1) + 50)); // 模拟人类操作，随机等待
            }

            // 移动完之后，松开鼠标
            await action.release().perform();


            console.log('滑块截图的Base64编码:', sliderBase64);
            // 获取滑块的大小和位置
            let sliderRect = await slider.getRect();
            let sliderWidth = sliderRect.width;


            // 计算拖动距离
            let dragDistance = sliderWidth - 10;

            // 使用 ActionChains 模拟拖动滑块
            let actions = new Actions(driver);
            await actions.clickAndHold(slider).perform();
            await actions.moveByOffset(dragDistance, 0).perform();
            await actions.release().perform();

            await new Promise(resolve => setTimeout(resolve, 99999999));
        } catch (error) {
            console.log(error)
        } finally {
            // 关闭浏览器
            await driver.quit();
        }


    }

    _uploadToVitePress = () => {
        console.log("上传到VitePress")
    }
}


module.exports = uploadUtil

