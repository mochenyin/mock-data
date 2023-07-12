const vscode = require('vscode');
const interfaceCreater = require("./interface-creater");

module.exports = vscode.commands.registerCommand('mock-data.mockClipboardData', function () {
    // 获取选中的文本
    const currentEditor = vscode.window.activeTextEditor;
    vscode.env.clipboard.readText().then(async (res) => {
        
        if (!res) {
            return;
        }
    
        // 将选中文本根据用户配置转换成 mock data
        const {interfaceCode, isError} = await interfaceCreater(res, {
            indent: 4,
            semicolonEnd: true,
        });
    
        if (isError === true) {
            vscode.window.showErrorMessage('InterfaceTransform生成mock数据失败!');
            return;
        }
    
        // 插入转换后的 mock data
        currentEditor.edit((editBuilder) => {
            const position = new vscode.Position(currentEditor.selection.active.line, currentEditor.selection.active.character)
            editBuilder.insert(position, interfaceCode);
        })
    });

});