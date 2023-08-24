/* modalExample 类展示了如何使用 this.modal 函数:
    直接使用this.modal即可弹出自定义的模态框，待用户点击【确定】后会调用回调函数

    this.modal:
     1. title（必须）: 模态框的标题
     2. components: 模态框里的内容，支持类型：
         1，input
         2. password
         3. p
         4. textarea
         5. checkbox
         6. radio
         7. select
*/
class modalExample extends BaseCustomPlugin {
    selector = () => ""
    callback = anchorNode => {
        const modal = {
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
                },
                {
                    label: "文件",
                    type: "file",  // 文件框
                },
            ]
        }
        this.modal(modal, components => {
            this.modal({
                title: "otherFile",
                component: [
                    {
                        label: "test textarea",
                        type: "textarea",
                        rows: 5,
                        placeholder: "请输入新文件路径",
                    },
                ]
            }, newComponents => {
                console.log("newComponents", newComponents);
            })
        })
    }
}

module.exports = {
    plugin: modalExample,
};