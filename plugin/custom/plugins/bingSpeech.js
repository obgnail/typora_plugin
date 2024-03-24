/* 本插件:
*    1.实现原理：采用爬虫技术，盗取必应翻译的播放语音功能
*    2.功能完全依赖于外部环境，因此不能保证成功
*    3.开发者一时兴起做的，仅作娱乐使用
*/
class bingSpeech extends BaseCustomPlugin {
    selector = onClick => {
        if (onClick) return;
        this.savedSelection = window.getSelection().getRangeAt(0);
        if (this.savedSelection.collapsed) {
            this.savedSelection = null;
            return this.utils.nonExistSelector
        }
    }

    hint = isDisable => isDisable ? "请框选一小段文字" : "功能依赖外部环境，不能保证成功，仅作娱乐使用"

    hotkey = () => [this.config.hotkey]

    callback = () => {
        const voiceList = [
            "zh-CN-YunxiNeural", "zh-CN-XiaoxiaoNeural", "zh-CN-XiaoyiNeural", "zh-CN-YunjianNeural", "zh-CN-YunxiaNeural",
            "zh-CN-YunyangNeural", "zh-CN-liaoning-XiaobeiNeural", "zh-CN-shaanxi-XiaoniNeural", "zh-HK-HiuMaanNeural", "zh-HK-WanLungNeural",
            "zh-HK-HiuGaaiNeural", "zh-TW-HsiaoChenNeural", "zh-TW-YunJheNeural", "zh-TW-HsiaoYuNeural",
        ]
        const {from_language, voice, rate, pitch} = this.config;
        const components = [
            {label: "语言", type: "input", value: from_language},
            {label: "语音", type: "select", selected: voice, list: voiceList},
            {label: "语速（如: 20%、-50%、0%）", type: "input", value: rate},
            {label: "语调（如: 20%、-50%、0%）", type: "input", value: pitch},
        ]
        this.utils.modal({title: "必应朗读", components}, async components => {
            const [c1, c2, c3, c4] = components.map(c => c.submit);
            await this.speech(null, {from_language: c1, voice: c2, rate: c3, pitch: c4});
        })
    }

    speech = async (text, config) => {
        text = this.getText(text);
        if (!text) {
            console.debug("has not text");
            return
        }
        const audioContext = new window.AudioContext();
        await this.crawl(text, config, async binary => {
            const audioBuffer = await audioContext.decodeAudioData(binary.buffer);
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            const playPromise = new Promise(resolve => source.onended = resolve);  // 音频播放结束时resolve promise
            source.start(0);
            return playPromise;
        })
    }

    // 生成的文件是mp3格式
    // 为了防止有人干坏事，此方法并不暴露到产品中
    download = async (filepath, text, config) => {
        text = this.getText(text);
        if (!text) {
            console.debug("has not text");
            return
        }
        const chunks = [];
        await this.crawl(text, config, binary => chunks.push(binary));
        await this.utils.Package.Fs.promises.writeFile(filepath, Buffer.concat(chunks));
        console.debug("done");
    }

    getText = text => {
        if (!text && this.savedSelection) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(this.savedSelection);
            text = File.editor.UserOp.getSpeechText();
        }
        this.savedSelection = null;
        return text
    }

    translate = async (text, fromLang, toLang) => {
        console.debug("start translate");
        const config = (fromLang && toLang)
            ? Object.assign({...this.config}, {from_language: fromLang, to_language: toLang})
            : this.config
        const spider = new bingSpeechSpider(this);
        return await spider.translate(config, text)
    }

    crawl = async (text, config, iter) => {
        console.debug("start crawl");
        config = Object.assign({...this.config}, config);
        const spider = new bingSpeechSpider(this);
        for await (const binary of spider.crawl(config, text)) {
            await iter(binary);
        }
    }
}

class bingSpeechSpider {
    constructor(controller) {
        this.utils = controller.utils;
    }

    async* crawl(config, text) {
        try {
            const options = await this._genOptions(config);
            const groups = this._groupText(options, text);
            for (const g of groups) {
                yield this._genAudio(options, g);
            }
        } catch (e) {
            alert("speech Error:", e.toString());
        }
    }

    translate = async (config, text) => {
        const options = await this._genOptions(config);

        const pathParams = new URLSearchParams();
        pathParams.append("IG", options.IG);
        pathParams.append("IID", options.IID);
        pathParams.append("isVertical", "1");
        const path = "/ttranslatev3?" + pathParams.toString()   // 翻译API

        const {from_language: from, to_language: to} = config;
        const bodyParams = new URLSearchParams();
        bodyParams.append("key", options.Key);
        bodyParams.append("token", options.Token);
        bodyParams.append("from", from);
        bodyParams.append("fromLang", from);
        bodyParams.append("to", to);
        bodyParams.append("text", text);
        const body = bodyParams.toString();

        const requestOptions = this._getPostRequestOptions(path, body);
        const buffer = await this.utils.request(requestOptions, body);
        return JSON.parse(buffer.toString() || "{}")
    }

    _getPostRequestOptions = (path, body) => ({
        hostname: "cn.bing.com",
        port: 443,
        path: path,
        method: "POST",
        headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": Buffer.byteLength(body),
        },
        followAllRedirects: true,
    })

    _genOptions = async config => {
        const response = await fetch("https://cn.bing.com/translator");  // 获取参数的API
        const result = await response.text();
        const matchIG = result.match(/IG:"(?<ig>[0-9a-zA-Z]*?)"/);
        const matchToken = result.match(/params_AbusePreventionHelper\s*?=\s*?\[(?<token>.*?)\]/);
        const ig = matchIG && matchIG.groups && matchIG.groups.ig;
        const token = matchToken && matchToken.groups && matchToken.groups.token;
        if (!ig || !token) {
            throw Error("get options error: !ig || !token");
        }
        const tokenArr = token.split(",");
        if (tokenArr.length < 3) {
            throw Error("get options error: tokenArr.length < 3");
        }
        const {voice, rate, pitch, from_language, to_language, group_lines} = config;
        return {
            // token
            IG: ig, IID: "translator.5024", Key: tokenArr[0], Token: tokenArr[1].replace(/"/g, ""),
            // 文本转语音参数
            VoiceName: voice, ProsodyPitch: pitch, ProsodyRate: rate,
            // 翻译
            FromLang: from_language, ToLang: to_language,
            // 将x行文本作为一组数据发送给bing，减少请求次数
            groupLines: group_lines || 3
        }
    }

    _groupText = (options, text) => {
        const lines = text
            .replace(/\r\n/g, "\n")
            .replace(/\n+/g, "\n")
            .split("\n")
            .map(line => this.utils.escape(line.trim()))
            .filter(Boolean)

        return lines.reduce((acc, current, idx) => {
            if (idx % options.groupLines === 0) {
                acc.push([current]);
            } else {
                acc[acc.length - 1].push(current);
            }
            return acc;
        }, []).map(ele => ele.join("\n"))
    }

    _genAudio = async (options, line) => {
        const pathParams = new URLSearchParams();
        pathParams.append("IG", options.IG);
        pathParams.append("IID", options.IID + ".2");
        pathParams.append("isVertical", "1");
        const path = "/tfettts?" + pathParams.toString()   // 转语音API

        const bodyParams = new URLSearchParams();
        const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN"><voice name="${options.VoiceName}"><prosody pitch="${options.ProsodyPitch}" rate="${options.ProsodyRate}">${line}</prosody></voice></speak>`
        bodyParams.append("key", options.Key);
        bodyParams.append("ssml", ssml);
        bodyParams.append("token", options.Token);
        const body = bodyParams.toString();

        const requestOptions = this._getPostRequestOptions(path, body);
        return this.utils.request(requestOptions, body)
    }
}

module.exports = {
    plugin: bingSpeech,
};