const message = require("./message.js");
const mockClipboardData = require("./mock-clipboard-data.js");

function activate(context) {
	context.subscriptions.push(message);
	context.subscriptions.push(mockClipboardData);
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}