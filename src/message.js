const vscode = require('vscode');

module.exports = vscode.commands.registerCommand('mock-data.start', function () {
    vscode.window.showInformationMessage('mock-data 已启动!');
});