const BaseUploaderInterface = require("./BaseUploaderInterface");

/**
 * 上传到博客园的插件实现
 */
class CnBlogUploader extends BaseUploaderInterface {
    getName() {
        return "cnblog";
    }

    async upload(title, content, extraData, options) {
        const { Builder, By, Key, until } = require('selenium-webdriver');
        require('chromedriver');
        const Notification = require('../utils/customNotification.js').plugin;
        const notification = new Notification();

        const SELENIUM_WAIT_FIX_TIME_LEVEL1 = 2000;
        const SELENIUM_WAIT_FIX_TIME_LEVEL2 = 4000;
        const SELENIUM_EXPLICIT_WAIT_TIME = 10000;

        let driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
        try {
            await driver.manage().window().maximize();
            await driver.get('https://account.cnblogs.com/signin?returnUrl=https:%2F%2Fwww.cnblogs.com%2F');
            await driver.findElement(By.css('input[formcontrolname="username"]')).sendKeys(this.config.upload.cnblog.username);
            await driver.findElement(By.css('input[formcontrolname="password"]')).sendKeys(this.config.upload.cnblog.password, Key.RETURN);
            await driver.findElement(By.css("button.mat-flat-button.mat-primary")).click();
            let verificationButton = await driver.findElement(By.id("SM_TXT_1"));
            await driver.wait(until.elementIsVisible(verificationButton), 10000);
            await driver.executeScript("arguments[0].scrollIntoView(true);", verificationButton);
            await driver.executeScript("Object.defineProperty(navigator, 'webdriver', { get: () => undefined })");
            await driver.executeScript("Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3' })");
            await driver.executeScript("arguments[0].click();", verificationButton);
            await driver.sleep(SELENIUM_WAIT_FIX_TIME_LEVEL2);
            let postArticleButton = await driver.findElement(By.css('a.navbar-user-info.navbar-blog'));
            await driver.wait(until.elementIsVisible(postArticleButton), SELENIUM_EXPLICIT_WAIT_TIME);
            await driver.executeScript("arguments[0].scrollIntoView(true);", postArticleButton);
            await driver.executeScript("arguments[0].click();", postArticleButton);
            await driver.wait(until.elementLocated(By.id('post-title')), SELENIUM_EXPLICIT_WAIT_TIME);
            await driver.wait(until.elementLocated(By.id('md-editor')), SELENIUM_EXPLICIT_WAIT_TIME);
            await driver.findElement(By.id('post-title')).sendKeys(title);
            let editor = await driver.wait(until.elementLocated(By.id('md-editor')), SELENIUM_EXPLICIT_WAIT_TIME);
            await driver.wait(until.elementIsVisible(editor), SELENIUM_EXPLICIT_WAIT_TIME);
            const jsCode = `
                var elm = arguments[0], txt = arguments[1];
                elm.value = txt;
                elm.dispatchEvent(new Event('input'));
                elm.dispatchEvent(new Event('change'));
            `;
            await driver.executeScript(jsCode, editor, content);
            await driver.sleep(SELENIUM_WAIT_FIX_TIME_LEVEL1);
            let publishButton = await driver.findElement(By.css('button[data-el-locator="publishBtn"]'));
            await driver.wait(until.elementIsVisible(publishButton), SELENIUM_EXPLICIT_WAIT_TIME);
            await publishButton.click();
            await driver.sleep(SELENIUM_WAIT_FIX_TIME_LEVEL2);
            notification.showNotification("博客园博客发布流程已完毕", "success");
        } catch (e) {
            notification.showNotification("博客园发布博客失败", "error");
            console.log(e);
        } finally {
            await driver.quit();
        }
    }
}

module.exports = CnBlogUploader;
