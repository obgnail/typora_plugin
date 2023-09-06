/* modalExample 类展示了如何使用 this.modal 函数:
    直接使用this.modal即可弹出自定义的模态框，待用户点击【确定】后会调用回调函数

    this.modal args:
      1. modal:
          - title（必须）: 模态框的标题
          - components: 模态框里的组件，支持类型：
              1，input
              2. password
              3. p
              4. textarea
              5. checkbox
              6. radio
              7. select
              8. file
      2. onSubmitCallback: 当用户点击【确认】后的回调函数
      3. onCancelCallback: 当用户点击【取消】后的回调函数
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
            console.log(components);

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