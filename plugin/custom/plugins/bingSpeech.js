class bingSpeech extends BaseCustomPlugin {
    init = () => {
        this.ParamsApi = "https://cn.bing.com/translator"   // 获取参数的API
        this.AudioApi = "https://cn.bing.com/tfettts"      // 转语音API
        this.UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    }

    callback = async () => {
        const options = await this.genOptions();
        if (!options) {
            console.log("error")
            return
        }
        const text = "不知不觉已经沦为弃子的邻居少年，日子倒是依旧过得优哉游哉，成天带着他的贴身丫鬟，在小镇内外逛荡，一年到头游手好闲，也从来不曾为银子发过愁。";
        await this.textToAudio(options, text);
    }

    genOptions = async () => {
        const response = await fetch(this.ParamsApi, {
            method: 'GET',
            headers: new Headers({'User-Agent': this.UA})
        })
        const result = await response.text();
        const matchIG = result.match(/IG:"(?<ig>[0-9a-zA-Z]*?)"/);
        const matchToken = result.match(/params_AbusePreventionHelper\s*?=\s*?\[(?<token>.*?)\]/);
        const ig = matchIG && matchIG.groups && matchIG.groups.ig;
        const token = matchToken && matchToken.groups && matchToken.groups.token;
        if (!ig || !token) return;
        const tokenArr = token.split(",");
        if (tokenArr.length < 3) return;
        return {
            IG: ig,
            IID: "translator.5024",
            Key: tokenArr[0],
            Token: tokenArr[1].replace(/"/g, ""),

            // 文本转语音参数
            VoiceName: "zh-CN-YunXiNeural", // 文本转语音输出的语音角色
            ProsodyPitch: "0%",     // 指示文本的基线音节。
            ProsodyRate: "+20%",   // 指示文本的讲出速率。

            // 翻译
            FromLang: "zh-Hans",
            ToLang: "en"
        }
    }

    textToAudio = async (options, text) => {
        const bodyList = text
            .replace(/\r\n/g, "\n")
            .replace(/\n+/g, "\n")
            .split("\n")
            .map(line => this.utils.escape(line.trim()))
            .filter(Boolean)
            .map(line => {
                const data = new URLSearchParams();
                const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN"><voice name="${options.VoiceName}"><prosody pitch="${options.ProsodyPitch}" rate="${options.ProsodyRate}">${line}</prosody></voice></speak>`
                data.append("key", options.Key);
                data.append("ssml", ssml);
                data.append("token", options.Token);
                return data.toString()
            })

        const buffers = await Promise.all(bodyList.map(async body => {
            const url = new URL(this.AudioApi);
            url.searchParams.append("IG", options.IG);
            url.searchParams.append("IID", options.IID + ".2");
            url.searchParams.append("isVertical", "1");
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'User-Agent': this.UA,
                    "Content-Type": "application/x-www-form-urlencoded",
                    credentials: "include",
                },
                body: body,
            })
            return await resp.arrayBuffer()
        }))

        // 合并二进制数据
        const combinedBuffer = new Uint8Array(buffers.reduce((acc, buffer) => {
            const tmp = new Uint8Array(acc.byteLength + buffer.byteLength);
            tmp.set(new Uint8Array(acc), 0);
            tmp.set(new Uint8Array(buffer), acc.byteLength);
            return tmp;
        }, new ArrayBuffer(0)));

        const audioContext = new window.AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(combinedBuffer.buffer);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start(0);
    }
}

module.exports = {
    plugin: bingSpeech,
};