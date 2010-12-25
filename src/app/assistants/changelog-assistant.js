function ChangelogAssistant(controller) {
	this.controller = controller;
}

ChangelogAssistant.prototype.setup = function(widget) {
	this.widget = widget;
	this.controller.setupWidget("okButton",
								{type: Mojo.Widget.defaultButton},
								{label: $LL("OK"), disabled: false});
	this.controller.listen("okButton", Mojo.Event.tap, this.widget.mojo.close);
};

ChangelogAssistant.prototype.activate = function(event) {
};

ChangelogAssistant.prototype.deactivate = function(event) {
};

ChangelogAssistant.prototype.cleanup = function(event) {
	this.controller.stopListening("okButton", Mojo.Event.tap, this.widget.mojo.close);
};
