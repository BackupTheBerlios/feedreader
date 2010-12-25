/*
 *		app/assistants/addfeed-assistant.js
 */

/* FeedReader - A RSS Feed Aggregator for Palm WebOS
 * Copyright (C) 2009, 2010, 2011 Timo Tegtmeier
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 3
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */

function AddfeedAssistant(feeds, feed) {
	this.feeds = feeds;
	this.feed = feed;

	if(!this.feed) {
		this.feed = new feedProto();
		this.feed.feedType = feedTypes.ftRSS;
		this.isAdd = true;
	} else {
		this.feed = new feedProto(feed);
		this.feed.feedType = feed.feedType;
		this.isAdd = false;
	}
	
	if(this.feed.showListSummary && this.feed.showListCaption) {
		this.listMode = 0;
	} else if(this.feed.showListCaption) {
		this.listMode = 1;
	} else if(this.feed.showListSummary) {
		this.listMode = 2;
	}

	if(this.feed.showDetailSummary && this.feed.showDetailCaption) {
		this.detailMode = 0;
	} else if(this.feed.showDetailCaption) {
		this.detailMode = 1;
	} else if(this.feed.showDetailSummary) {
		this.detailMode = 2;
	}
	
	this.feedUpdateFailed = this.feedUpdateFailed.bind(this);
	this.feedUpdateSuccess = this.feedUpdateSuccess.bind(this);
}

AddfeedAssistant.prototype.setup = function() {
	SceneControl.beginSceneSetup(this);

	this.controller.setupWidget("feedURL",
								{ hintText: $L("RSS/ATOM Feed"), autoFocus: true, limitResize: true,
								  autoReplace: false, textCase: Mojo.Widget.steModeLowerCase, enterSubmits: false },
								this.urlModel = { value: this.feed.url });
	this.controller.setupWidget("feedTitle",
								{ hintText: $L("Feed title"), limitResize: true, autoReplace: true,
								  textCase: Mojo.Widget.steModeTitleCase, enterSubmits: false },
								this.titleModel = { value: this.feed.title });

	this.controller.setupWidget("feedUser",
								{ hintText: $L("Username"), limitResize: true, autoReplace: true,
								  textCase: Mojo.Widget.steModeLowerCase, enterSubmits: false },
								this.userModel = { value: this.feed.username });
	this.controller.setupWidget("feedPassword",
								{ hintText: $L("Password"), limitResize: true,
								  textCase: Mojo.Widget.steModeLowerCase, enterSubmits: false },
								this.passwordModel = { value: this.feed.password });
    
	this.controller.setupWidget("listMode", {
		label: $L("Show"),
        choices: [
            { label: $L("Caption and summary"),	value: 0 },
            { label: $L("Caption only"),		value: 1 },
			{ label: $L("Summary only"),		value: 2 }
        ]},
		this.listModeModel = {
			value: this.listMode,
			disabled: false
		});

	this.controller.setupWidget("sortMode", {
		label: $L("Filter"),
        choices: [
            { label: $L("Show all items"),		value: 0 },
            { label: $L("Show unread items"),	value: 1 },
			{ label: $L("Show new items"),		value: 2 }
        ]},
		this.sortModeModel = {
			value: this.feed.sortMode,
			disabled: false
		});
	
	this.controller.setupWidget("detailMode", {
		label: $L("Show"),
        choices: [
            { label: $L("Caption and summary"),	value: 0 },
            { label: $L("Caption only"),		value: 1 },
			{ label: $L("Summary only"),		value: 2 }
        ]},
		this.detailModeModel = {
			value: this.detailMode,
			disabled: false
		});
	
	this.controller.setupWidget("feedEnabled", {
		property: "value",
		trueLabel: $L("Yes"),
		trueValue: 1,
		falseLabel: $L("No"),
		falseValue: 0
	}, this.enabledModel = {
		value: this.feed.enabled,
		disabled: false
	});

	this.controller.setupWidget("showPicture", {
		property: "value",
		trueLabel: $L("Yes"),
		trueValue: 1,
		falseLabel: $L("No"),
		falseValue: 0
	}, this.showPictureModel = {
		value: this.feed.showPicture,
		disabled: false
	});

	this.controller.setupWidget("showMedia", {
		property: "value",
		trueLabel: $L("Yes"),
		trueValue: 1,
		falseLabel: $L("No"),
		falseValue: 0
	}, this.showMediaModel = {
		value: this.feed.showMedia,
		disabled: false
	});

	this.controller.setupWidget("fullStory", {
		property: "value",
		trueLabel: $L("Yes"),
		trueValue: 1,
		falseLabel: $L("No"),
		falseValue: 0
	}, this.fullStoryModel = {
		value: this.feed.fullStory,
		disabled: false
	});


	this.controller.setupWidget("allowHTML", {
		property: "value",
		trueLabel: $L("Yes"),
		trueValue: 1,
		falseLabel: $L("No"),
		falseValue: 0
	}, this.allowHTMLModel = {
		value: this.feed.allowHTML,
		disabled: false
	});
    
	this.okButton = this.controller.get("okButton");
	this.controller.setupWidget("okButton", { type: Mojo.Widget.activityButton },
								this.okButtonModel = {
									buttonClass: "affirmative",
									label: $LL("OK"),
									disabled: false
								});
	this.controller.listen("okButton", Mojo.Event.tap, this.updateFeed.bindAsEventListener(this));
          
	this.controller.setupWidget("cancelButton",
								{ type: Mojo.Widget.defaultButton }, {
									buttonClass: "negative",
									label: $LL("Cancel"),
									disabled: false
								});
	this.controller.listen("cancelButton", Mojo.Event.tap, this.cancelClick.bindAsEventListener(this));
	
	if (this.isAdd) {
		this.controller.get("addfeed-title").update($L("Add new Feed"));
	} else {
		this.controller.get("addfeed-title").update($L("Edit Feed"));
	}
	
	this.controller.get("feedEnabled-title").update($L("Activate Feed"));
	this.controller.get("feedURL-title").update($L("URL"));
	this.controller.get("feedTitle-title").update($L("Title"));

	this.controller.get("feed-group-title").update($L("Basic settings"));
	this.controller.get("auth-group-title").update($L("Authentication"));
	this.controller.get("storylist-group-title").update($L("Story list"));
	this.controller.get("detail-group-title").update($L("Story details"));
	
	this.controller.get("fullStory-title").update($L("Show details"));
	this.controller.get("showMedia-title").update($L("Show media"));
	this.controller.get("showPicture-title").update($L("Show picture"));
	this.controller.get("allowHTML-title").update($L("Allow HTML"));
	
	SceneControl.endSceneSetup(this);
};

AddfeedAssistant.prototype.cleanup = function(event) {
};

AddfeedAssistant.prototype.cancelClick = function() {
	this.controller.stageController.popScene();
};

AddfeedAssistant.prototype.updateFeed = function() {
	if(!this.urlModel.value) {	// In case no url is entered, simply exit the scene.
		this.controller.stageController.popScene();
		return;
	}
	
    this.feed.url = this.urlModel.value;
	this.feed.title = this.titleModel.value;
	this.feed.enabled = this.enabledModel.value;

	this.feed.username = this.userModel.value;
	this.feed.password = this.passwordModel.value;

	this.feed.showListCaption = (this.listModeModel.value == 0) || ((this.listModeModel.value % 2) == 1);
	this.feed.showListSummary = (this.listModeModel.value % 2) == 0;

	this.feed.showDetailCaption = (this.detailModeModel.value == 0) || ((this.detailModeModel.value % 2) == 1);
	this.feed.showDetailSummary = (this.detailModeModel.value % 2) == 0;

	this.feed.showPicture = this.showPictureModel.value;
	this.feed.showMedia = this.showMediaModel.value;
	this.feed.sortMode = this.sortModeModel.value;
	this.feed.allowHTML = this.allowHTMLModel.value;
	this.feed.fullStory = this.fullStoryModel.value;
	
    if(/^[a-z]{1,5}:/.test(this.feed.url) === false) {
        this.feed.url = this.feed.url.replace(/^\/{1,2}/, "");                                
        this.feed.url = "http://" + this.feed.url;
    }
	
    // Update the entered URL & model.
    this.urlModel.value = this.feed.url;
    this.controller.modelChanged(this.urlModel);

	// Update the OK button.	
	this.okButtonModel.label = this.isAdd ? $L("Adding Feed...") : $L("Updating Feed...");
	this.okButtonModel.disabled = true;
	this.controller.modelChanged(this.okButtonModel);

	// Save the feed.
	this.feeds.addOrEditFeed(this.feed, this.feedUpdateSuccess, this.feedUpdateFailed);
};

AddfeedAssistant.prototype.feedUpdateFailed = function(transaction, error) {
	this.okButtonModel.label = $LL("OK");
	this.controller.modelChanged(this.okButtonModel);
	this.okButton.mojo.deactivate();

	Mojo.Log.error("DB>", error.message);
	
	var errorMsg = new Template($L("Editing the Feed '#{title}' failed."));
	FeedReader.showError(errorMsg, { title: this.feed.url } );
};

AddfeedAssistant.prototype.feedUpdateSuccess = function(feed) {
	this.feed.id = feed.id;
	if(this.feed.enabled) {
		this.feeds.enqueueUpdate(this.feed);
	}
	this.okButton.mojo.deactivate();
	this.controller.stageController.popScene();
};
