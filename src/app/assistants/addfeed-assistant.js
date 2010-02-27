/*
 *		app/assistants/addfeed-assistant.js
 */

/* FeedReader - A RSS Feed Aggregator for Palm WebOS
 * Copyright (C) 2009, 2010 Timo Tegtmeier
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

function AddfeedAssistant(feeds, index) {
	this.feeds = feeds;

	if (!index) {
		this.feed = null;
		this.index = -1;
		this.url = "";
		this.title = "";
		this.enabled = true;
		this.viewMode = 1;
		this.showMedia = true;
		this.showPicture = true;
	} else {
		this.feed = feeds.list[index];
		this.index = index;
		this.url = this.feed.url;
		this.title = this.feed.title;
		this.enabled = this.feed.enabled;
		this.viewMode = this.feed.viewMode;
		this.showMedia = this.feed.showMedia;
		this.showPicture = this.feed.showPicture;
	}
}

AddfeedAssistant.prototype.setup = function() {
	this.controller.setupWidget("feedURL",
								{ hintText: $L("RSS/ATOM Feed"), autoFocus: true, limitResize: true,
								  autoReplace: false, textCase: Mojo.Widget.steModeLowerCase, enterSubmits: false },
								this.urlModel = { value: this.url });
	this.controller.setupWidget("feedTitle",
								{ hintText: $L("Optional"), limitResize: true, autoReplace: true,
								  textCase: Mojo.Widget.steModeTitleCase, enterSubmits: false },
								this.titleModel = { value: this.title });
    
	this.controller.setupWidget("listMode", {
		label: $L("Show"),
        choices: [
            { label: $L("Caption and summary"),	value: 0 },
            { label: $L("Caption only"),		value: 1 },
			{ label: $L("Summary only"),		value: 2 }
        ]},
		this.listModeModel = {
			value: (this.viewMode >> 16) & 0xFF,
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
			value: (this.viewMode >> 24) & 0xFF,
			disabled: false
		});	


	this.controller.setupWidget("fullStory", {
		property: "value",
		trueLabel: $L("Yes"),
		falseLabel: $L("No"),
		trueValue: 1,
		falseValue: 0
	}, this.fullStoryModel = {
		value: this.viewMode & 0xFFFF
	});
	
	this.controller.setupWidget("feedEnabled", {
		property: "value",
		trueLabel: $L("Yes"),
		falseLabel: $L("No")
	}, this.enabledModel = {
		value: this.enabled,
		disabled: false
	});

	this.controller.setupWidget("showPicture", {
		property: "value",
		trueLabel: $L("Yes"),
		falseLabel: $L("No")
	}, this.showPictureModel = {
		value: this.showPicture,
		disabled: false
	});

	this.controller.setupWidget("showMedia", {
		property: "value",
		trueLabel: $L("Yes"),
		falseLabel: $L("No")
	}, this.showMediaModel = {
		value: this.showMedia,
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
	
	if (this.feed === null) {
		this.controller.get("addfeed-title").update($L("Add new Feed"));
	} else {
		this.controller.get("addfeed-title").update($L("Edit Feed"));
	}
	
	this.controller.get("feedEnabled-title").update($L("Activate Feed"));
	this.controller.get("feedURL-title").update($L("URL"));
	this.controller.get("feedTitle-title").update($L("Title"));

	this.controller.get("feed-group-title").update($L("Basic settings"));
	this.controller.get("storylist-group-title").update($L("Story list"));
	this.controller.get("detail-group-title").update($L("Story details"));
	
	this.controller.get("showMedia-title").update($L("Show media"));
	this.controller.get("showPicture-title").update($L("Show picture"));
	
	this.controller.get("fullStory-title").update($L("Show full stories"));
};

AddfeedAssistant.prototype.cleanup = function(event) {
};

AddfeedAssistant.prototype.cancelClick = function() {
	this.controller.stageController.popScene();
};

AddfeedAssistant.prototype.updateFeed = function() {
    var url = this.urlModel.value;
	var title = this.titleModel.value;
	var enabled = this.enabledModel.value;
	var listMode = this.listModeModel.value;
	var detailMode = this.detailModeModel.value;
	var fullStoryMode = this.fullStoryModel.value;
	var viewMode = (detailMode << 24) | (listMode << 16) | (fullStoryMode & 0xFF);
	var showPicture = this.showPictureModel.value;
	var showMedia = this.showMediaModel.value;
	
    if(/^[a-z]{1,5}:/.test(url) === false) {
        url = url.replace(/^\/{1,2}/, "");                                
        url = "http://" + url;                                          
    }
    
    // Update the entered URL & model.
    this.urlModel.value = url;
    this.controller.modelChanged(this.urlModel);

	// Update the OK button.	
	this.okButtonModel.label = this.feed === null ? $L("Adding Feed...") : $L("Updating Feed...");
	this.okButtonModel.disabled = true;
	this.controller.modelChanged(this.okButtonModel);

	if(this.feed !== null) {
		FeedReader.feeds.editFeed(this.index, title, url, enabled, viewMode,
								  showPicture, showMedia);
		this.okButton.mojo.deactivate();
		this.controller.stageController.popScene();
	} else {
		FeedReader.feeds.addFeed(title, url, enabled, viewMode,
								 showPicture, showMedia);
		this.okButton.mojo.deactivate();
		this.controller.stageController.popScene();
	}
}; 
