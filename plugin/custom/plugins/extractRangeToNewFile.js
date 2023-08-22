class extractRangeToNewFile extends BaseCustomPlugin {
    selector = () => ""
    hint = () => "提取选区文字到新文件中"
    init = () => {
    }
    style = () => {
    }
    html = () => {
    }
    hotkey = () => ["ctrl+shift+u"]
    process = () => {
    }
    callback = anchorNode => {
        this.modal({
            id: "newFile",
            title: "新文件路径",
            components: [
                {
                    label: "文件路径",
                    type: "input",  // 输入框
                    value: "123",
                    placeholder: "请输入新文件路径",
                },
                {
                    label: "test password",
                    type: "password",  // 密码框
                    value: "123",
                    placeholder: "password",
                },
                {
                    label: "test pure text",
                    type: "p",  // 纯文本
                },
                {
                    label: "test textarea",
                    type: "textarea",  // 多行文本框
                    rows: 5,
                    placeholder: "请输入新文件路径",
                },
                {
                    label: "test checkbox",
                    type: "checkbox",  // 复选框
                    list: [
                        {
                            label: "label1",
                            value: "value1",
                            checked: true,
                        },
                        {
                            label: "label2",
                            value: "value2",
                        }
                    ],
                },
                {
                    label: "test radio",
                    type: "radio",
                    list: [
                        {
                            label: "label1",
                            value: "value1",
                            checked: true,
                        },
                        {
                            label: "label2",
                            value: "value2",
                        }
                    ]
                },
                {
                    label: "test select",
                    type: "select",
                    selected: "option2",
                    list: [
                        "option1",
                        "option2",
                        "option3",
                        "option4",
                    ]
                }
            ]
        })
    }

    onEvent = (eventType, payload) => {
        if (
            eventType !== "submit"
            || !payload
            || !payload.id
            || payload.id !== "newFile"
            || !payload.components
        ) return;

        console.log(payload)
    }
}

module.exports = {
    plugin: extractRangeToNewFile,
};