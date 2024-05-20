// 实现原理：采用爬虫技术，盗取必应翻译的播放语音功能。功能完全依赖于外部环境，因此不能保证成功。
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
            "zh-CN-YunxiNeural",
            "zh-CN-XiaoxiaoNeural",
            "zh-CN-XiaoyiNeural",
            "zh-CN-YunjianNeural",
            "zh-CN-YunxiaNeural",
            "zh-CN-YunyangNeural",
            "zh-CN-liaoning-XiaobeiNeural",
            "zh-CN-shaanxi-XiaoniNeural",
            "zh-HK-HiuMaanNeural",
            "zh-HK-WanLungNeural",
            "zh-HK-HiuGaaiNeural",
            "zh-TW-HsiaoChenNeural",
            "zh-TW-YunJheNeural",
            "zh-TW-HsiaoYuNeural",
        ]
        const styleMap = {
            neutral: "中性",
            sad: "悲伤",
            whispering: "柔和",
            terrified: "害怕",
            envious: "钦佩",
            newscast: "正式专业",
            unfriendly: "冷淡无情",
            calm: "沉着冷静",
            chat: "轻松随意",
            cheerful: "积极愉快",
            customerservice: "友好热情",
            sports_commentary: "体育解说",
            affectionate: "温暖、亲切",
            angry: "生气、厌恶",
            assistant: "热情、轻松",
            depressed: "忧郁、沮丧",
            disgruntled: "轻蔑、抱怨",
            empathetic: "关心、理解",
            fearful: "恐惧、紧张",
            hopeful: "温暖、渴望",
            lyrical: "优美、感伤",
            "narration-professional": "专业、客观",
            "narration-relaxed": "舒缓、悦耳",
            "newscast-casual": "通用、随意",
            serious: "严肃、命令",
            embarrassed: "不确定、犹豫",
            "poetry-reading": "带情感、节奏",
            "documentary-narration": "轻松、感兴趣",
            advertisement_upbeat: "兴奋、精力充沛",
            excited: "乐观、充满希望",
            sports_commentary_excited: "快速、充满活力",
            friendly: "愉快、怡人、温暖",
            gentle: "温和、礼貌、愉快",
            "newscast-formal": "正式、自信、权威",
            shouting: "听起来好像声音在远处",
        }
        const operationMap = {speech: "朗读", download: "下载"};
        const styleDegreeMap = {"0": "低", "1": "中", "2": "高"};
        const {from_language, voice, rate, pitch, style, style_degree} = this.config;
        const num2Str = num => (parseInt(num) / 100).toFixed(1);
        const str2Num = str => (str.startsWith("-") ? "" : "+") + Math.floor(parseFloat(str) * 100) + "%";

        const genInfo = msg => `<span class="ion-information-circled" title="${msg}" style="opacity: 0.7;"></span>`;
        const warn = "⚠️ 本插件的功能完全依赖于外部环境，因此不能保证成功" + " " + genInfo("采用爬虫技术盗取必应翻译的语音，因此成功与否完全取决于微软");
        const components = [
            {label: warn, type: "p"},
            {label: "操作", type: "select", selected: "speech", map: operationMap},
            {label: "语言", type: "input", value: from_language},
            {label: "语音", type: "select", selected: voice, list: voiceList},
            {label: "语气", type: "select", selected: style, map: styleMap},
            {label: "语气强度", type: "select", selected: style_degree + "", map: styleDegreeMap},
            {label: "语速", type: "range", min: -3.0, max: 3.0, step: 0.1, value: num2Str(rate)},
            {label: "语调", type: "range", min: -1.0, max: 1.0, step: 0.1, value: num2Str(pitch)},
        ]
        this.utils.modal({title: "必应朗读", components}, async components => {
            const [_, o, l, v, s, d, r, p] = components.map(c => c.submit);
            const cfg = {from_language: l, voice: v, style: s, style_degree: d, rate: str2Num(r), pitch: str2Num(p)};
            await this.utils.showProcessingHint();
            try {
                if (o === "speech") {
                    await this.speech(null, cfg);
                } else if (o === "download") {
                    const filepath = await this.download(null, null, cfg);
                    this.utils.showInFinder(filepath);
                }
            } catch (e) {
                alert(e.toString());
            }
            this.utils.hideProcessingHint();
        })
    }

    speech = async (text, config) => {
        text = this.getText(text);
        if (!text) {
            console.debug("has not text");
            return
        }
        const hideHint = this.utils.once(this.utils.hideProcessingHint);
        const audioContext = new window.AudioContext();
        await this.crawl(text, config, async binary => {
            hideHint();
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
    download = async (filepath, text, config) => {
        text = this.getText(text);
        if (!text) {
            console.debug("has not text");
            return
        }
        if (!filepath) {
            filepath = this.utils.Package.Path.join(this.utils.tempFolder, this.utils.randomString() + ".mp3");
        }
        const chunks = [];
        await this.crawl(text, config, binary => chunks.push(binary));
        await this.utils.Package.Fs.promises.writeFile(filepath, Buffer.concat(chunks));
        console.debug("done");
        return filepath
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
        text = this.getText(text);
        if (!text) {
            console.debug("has not text");
            return
        }
        console.debug("start translate");
        const config = (fromLang && toLang)
            ? Object.assign({...this.config}, {from_language: fromLang, to_language: toLang})
            : this.config
        const spider = new bingSpeechSpider(this);
        const resp = await spider.translate(config, text);
        return resp[0].translations.map(t => t.text).join("\n")
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
        const {voice, rate, pitch, style = "neutral", style_degree = 1, from_language, to_language, group_lines = 3} = config;
        return {
            // token
            IG: ig, IID: "translator.5024", Key: tokenArr[0], Token: tokenArr[1].replace(/"/g, ""),
            // 文本转语音参数
            VoiceName: voice, ProsodyPitch: pitch, ProsodyRate: rate, Style: style, StyleDegree: style_degree,
            // 翻译
            FromLang: from_language, ToLang: to_language,
            // 将x行文本作为一组数据发送给bing，减少请求次数
            groupLines: group_lines
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
        const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN"><voice name="${options.VoiceName}"><prosody pitch="${options.ProsodyPitch}" rate="${options.ProsodyRate}"><mstts:express-as style="${options.Style}" styledegree="${options.StyleDegree}">${line}</mstts:express-as></prosody></voice></speak>`
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