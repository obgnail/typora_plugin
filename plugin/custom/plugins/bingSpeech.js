/* 本插件:
*    1.实现原理：采用爬虫技术，盗取必应翻译的播放语音功能
*    2.功能完全依赖于外部环境，因此不能保证成功
*    3.开发者一时兴起做的，就图一乐，并不会维护它
*/
class bingSpeech extends BaseCustomPlugin {
    callback = async () => {
        if (File.editor.selection.getRangy().collapsed) {
            this.modal({title: "提示", components: [{label: "请框选一小段文字", type: "p"}]}, console.log);
        } else {
            await this.speech();
        }
    }

    speech = async text => {
        text = text || File.editor.UserOp.getSpeechText();
        const audioContext = new window.AudioContext();
        await this.crawl(text, async binary => {
            const audioBuffer = await audioContext.decodeAudioData(binary.buffer);
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            const playPromise = new Promise(resolve => source.onended = resolve);  // 音频播放结束时resolve promise
            source.start(0);
            return playPromise;
        })
    }

    download = async (filepath, text) => {
        text = text || File.editor.UserOp.getSpeechText();
        const chunks = [];
        await this.crawl(text, binary => chunks.push(binary));
        await this.utils.Package.Fs.promises.writeFile(filepath, Buffer.concat(chunks));
        console.log("done");
    }

    crawl = async (text, iter) => {
        const spider = new bingSpeechSpider(this);
        for await (const binary of spider.crawl(this.config, text)) {
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
            for await (const buffer of this._textToAudio(options, text)) {
                yield buffer
            }
        } catch (e) {
            alert("speech Error:", e.toString());
        }
    }

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
        const {voice, rate, pitch} = config;
        return {
            IG: ig,
            IID: "translator.5024",
            Key: tokenArr[0],
            Token: tokenArr[1].replace(/"/g, ""),

            // 文本转语音参数
            VoiceName: voice,
            ProsodyPitch: pitch,
            ProsodyRate: rate,

            // 翻译
            FromLang: "zh-Hans",
            ToLang: "en"
        }
    }

    async* _textToAudio(options, text) {
        const lines = text
            .replace(/\r\n/g, "\n")
            .replace(/\n+/g, "\n")
            .split("\n")
            .map(line => this.utils.escape(line.trim()))
            .filter(Boolean)

        for (const line of lines) {
            yield await this._genAudio(options, line);
        }
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

        const requestOptions = {
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
        }
        return this.utils.request(requestOptions, body)
    }
}

module.exports = {
    plugin: bingSpeech,
};