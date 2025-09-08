// ./plugin/custom/plugins/CompleteWithLLM.js

class CompleteWithLLM extends BaseCustomPlugin {
    // 定义插件的快捷键
    hotkey = () => [this.config.hotkey_string]

    // 定义插件的提示信息
    hint = () => "使用 LLM 补全选中的文本"

    // 定义插件的初始化逻辑
    init = () => {
        // 初始化变量
        this.selectedText = "";
    }

    // 定义插件的样式
    style = () => `
        #complete-with-llm-plugin {
            margin: 10px;
        }
    `

    // 定义插件的 HTML 结构
    html = () => "<div id='complete-with-llm-plugin'></div>"

    // 定义插件的处理逻辑
    process = () => {
        // 这里可以添加一些初始化逻辑
    }

    callback = async anchorNode =>  {
        // 获取用户选中的文本
        this.selectedText = window.getSelection().toString().replace(/\n\n+/g, '\n');

        if (!this.selectedText) {
            alert("请先选中一段文字");
            return;
        }

        try {
            const newContent = await this.sendToLLM(this.selectedText);

            // 将新内容插入到原内容的下一行
            console.log(`inserting the newContent ${newContent}`)
            // this.insertNewContent(newContent);
            this.utils.insertText(anchorNode, newContent)
        } catch (error) {
            console.error("LLM API 请求失败:", error);
            alert("LLM API 请求失败，请检查网络或 API 配置");
        }
    }

    sendToLLM = async function(text) {
        const {apiKey, url, model, prompt} = this.config;

        const data = {
            model: model,
            messages: [
                {"role": "system", "content": prompt},
                {"role": "user", "content": `input text: ${text}`}
            ],
            stream: false,
            temperature: 0.01
        };
    
        try {
            console.log(JSON.stringify(data))
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify(data),
            });
    
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const responseData = await response.json();
            if (responseData.choices && responseData.choices.length > 0) {
                return responseData.choices[0].message.content;
            } else {
                return "No response content found.";
            }
        } catch (error) {
            console.error("Error in chatting with LLM:", error.message);
            return `Error: ${error.message}`;
        }
    }

}

// 导出插件
module.exports = { plugin: CompleteWithLLM };