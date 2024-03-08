class chatPlugin extends BaseCustomPlugin {
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
        let chat = $pre.find(".plugin-chat");
        if (chat.length === 0) {
            chat = $(`<div class="plugin-chat"></div>`);
        }
        chat.html(`
            <div class="i-body">
                <div class="i-b-rec-text"><img src="/static/face/10033.jpg">
                    <div>
                        <p class="i-b-nick">擦掉眼泪我依旧是王</p>
                        <span>这个是示例对话哦，你先点击右上角绿色的 “清除对话”</span>
                    </div>
                </div>
                
                <div class="i-b-time"><span>昨天 08:33</span></div>
            
                <div class="i-b-sen-text"><img src="/static/face/10032.jpg">
                    <div>
                        <span>欢迎使用微信对话</span>
                    </div>
                </div>
                
                <div class="i-b-rec-text"><img src="/static/face/10028.jpg">
                    <div>
                        <p class="i-b-nick">wL69gVC</p>
                        <span>123</span>
                    </div>
                </div>
            </div>
        `);
        $pre.find(".md-diagram-panel-preview").html(chat);
    }

    getStyleContent = () => {

    }
}

module.exports = {
    plugin: chatPlugin,
};
