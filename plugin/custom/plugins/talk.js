class talkPlugin extends BaseCustomPlugin {
    styleTemplate = () => true

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE)

    process = () => {
        this.utils.registerDiagramParser(
            this.config.LANGUAGE,
            false,
            this.render,
            null,
            null,
            this.getStyleContent,
            this.config.INTERACTIVE_MODE
        );
    }

    render = (cid, content, $pre) => {
        let talk = $pre.find(".plugin-talk");
        if (talk.length === 0) {
            talk = $(`<div class="plugin-talk"></div>`);
        }
        talk.html(`
            <div class="i-body">
                <div class="i-b-rec-text"><img src="/static/face/10033.jpg">
                    <div>
                        <p class="i-b-nick" style="display: block;">擦掉眼泪我依旧是王</p>
                        <span>
                            <i></i>
                            <em>这个是示例对话哦，你先点击右上角绿色的 “清除对话”
                                <img class="qq_emoji" src="/static/images/qq_emoji/Expression_22@2x.png">
                            </em>
                            <a class="msg-del"></a>
                        </span>
                    </div>
                </div>
                
                <div class="i-b-time"><span>昨天 08:33</span><a class="msg-del"></a></div>
            
                <div class="i-b-sen-text"><img src="/static/face/10032.jpg">
                    <div><span><i></i><em>欢迎使用微信对话</em><a class="msg-del"></a></span></div>
                </div>
                
                <div class="i-b-rec-text"><img src="/static/face/10028.jpg">
                    <div>
                        <p class="i-b-nick" style="display: block;">wL69gVC</p><span><i></i><em>123</em><a class="msg-del"></a></span>
                    </div>
                </div>
            </div>
        `);
        $pre.find(".md-diagram-panel-preview").html(talk);
    }

    getStyleContent = () => {

    }
}

module.exports = {
    plugin: talkPlugin,
};
