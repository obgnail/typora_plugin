const BaseUploader = require("./base")
const SeleniumUtils = require("../utils/selenium")

class WordpressUploader extends BaseUploader {
  getName() {
    return "wordpress"
  }

  async upload(title, content, extraData) {
    const { Builder, By, Key, until } = require("selenium-webdriver")
    require("chromedriver")
    const { marked } = require("marked")

    const SELENIUM_WAIT_FIX_TIME_LEVEL1 = 2000
    const SELENIUM_EXPLICIT_WAIT_TIME = 10000

    const isHeadless = this.config.upload.selenium?.headless
    const options = SeleniumUtils.getChromeOptions(isHeadless)

    const driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build()
    try {
      await driver.manage().window().maximize()
      await driver.get(this.config.upload.wordpress.loginUrl)

      await driver.sleep(SELENIUM_WAIT_FIX_TIME_LEVEL1)
      const userInput = await driver.wait(until.elementLocated(By.id("user_login")), SELENIUM_EXPLICIT_WAIT_TIME)
      await driver.wait(until.elementIsVisible(userInput), SELENIUM_EXPLICIT_WAIT_TIME)
      await userInput.sendKeys(this.config.upload.wordpress.username)
      const passInput = await driver.wait(until.elementLocated(By.id("user_pass")), SELENIUM_EXPLICIT_WAIT_TIME)
      await driver.wait(until.elementIsVisible(passInput), SELENIUM_EXPLICIT_WAIT_TIME)
      await passInput.sendKeys(this.config.upload.wordpress.password, Key.RETURN)
      await driver.get(`${this.config.upload.wordpress.hostname}/wp-admin/post-new.php`)

      await driver.wait(until.elementLocated(By.name("post_title")), SELENIUM_EXPLICIT_WAIT_TIME)
      const titleField = await driver.findElement(By.name("post_title"))
      await titleField.sendKeys(title)

      await driver.wait(until.elementLocated(By.id("content_ifr")), SELENIUM_EXPLICIT_WAIT_TIME)
      const editorFrame = await driver.findElement(By.id("content_ifr"))
      await driver.switchTo().frame(editorFrame)

      const body = await driver.findElement(By.id("tinymce"))
      await driver.executeScript("arguments[0].innerHTML = arguments[1]", body, marked(content))

      await driver.switchTo().defaultContent()
      await driver.sleep(SELENIUM_WAIT_FIX_TIME_LEVEL1)

      await driver.wait(until.elementLocated(By.id("publish")), SELENIUM_EXPLICIT_WAIT_TIME)
      const publishButton = await driver.findElement(By.id("publish"))
      await publishButton.click()
    } catch (error) {
      throw new Error(`WordPress upload exception: ${error.message}`)
    } finally {
      await driver.quit()
    }
  }
}

module.exports = WordpressUploader
