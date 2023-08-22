/* modalExample 类展示了如何使用 this.modal 函数:
    直接使用this.modal即可弹出自定义的模态框，待用户点击【确定】后会回调给this.onEvent()，其中eventType参数为submit,payload即是this.modal里的参数，可以根据id获取

    this.modal:
     1. id（必须且唯一）: modal的id，后端回调给this.onEvent()时可以通过Id判断是哪一次的modal
     2. title（必须）: 模态框的标题
     3. components: 模态框里的内容，支持类型：
         1，input
         2. password
         3. p
         4. textarea
         5. checkbox
         6. radio
         7. select

    onEvent:
        当用户点击模态框的确认按钮后，就会自动回调该插件的onEvent函数, 其中eventType参数为submit,payload即是this.modal里的参数,
        并且会自动为每个component添加submit属性，表示用户提交的数据，
        如果要有多次弹窗，可以在onEvent里继续调用this.modal函数，此时的id不要于第一次相同，然后onEvent函数就可以通过payload.id判断是哪一次模态框了
*/
class modalExample extends BaseCustomPlugin {
    selector = () => ""
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
                    type: "radio",   // 单选框
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
                    type: "select",  // 单选菜单
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
        if (eventType !== "submit"
            || !payload
            || !payload.id
            || !payload.components
        ) return;

        if (payload.id === "newFile") {
            console.log("newFile", payload);
        } else if (payload.id === "otherFile") {
            console.log("otherFile", payload);
        } else {
            this.modal({
                id: "otherFile",
                title: "otherFile",
                component: [
                    {
                        label: "test textarea",
                        type: "textarea",
                        rows: 5,
                        placeholder: "请输入新文件路径",
                    },
                ]
            })
        }
    }
}

module.exports = {
    plugin: modalExample,
};