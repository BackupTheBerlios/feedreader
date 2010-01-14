/*
 *		app/assistants/addfeed-assistant.js
 */

/* FeedReader - A RSS Feed Aggregator for Palm WebOS
 * Copyright (C) 2009, 2010 Timo Tegtmeier
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
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

function AddfeedAssistant(controller, feeds, index) {
	// In case this scene is to be used as a dialog,
	// the controller will be passed in.
	if(controller !== null) {
		this.controller = controller;
	}
	
	this.feeds = feeds;
	
	if (index === undefined) {
		this.feed = null;
		this.index = -1;
		this.url = "";
		this.title = "";
		this.enabled = true;
	} else {
		this.feed = feeds.list[index];
		this.index = index;
		this.url = this.feed.url;
		this.title = this.feed.title;
		this.enabled = this.feed.enabled;
	}
}

AddfeedAssistant.prototype.setup = function(widget) {
	this.widget = widget;
	
	this.controller.setupWidget("feedURL",
								{ hintText: $L("RSS/ATOM Feed"), autoFocus: true, limitResize: true,
								  autoReplace: false, textCase: Mojo.Widget.steModeLowerCase, enterSubmits: false },
								this.urlModel = {value: this.url});
	this.controller.setupWidget("feedTitle",
								{ hintText: $L("Optional"), limitResize: true, autoReplace: false,
								  textCase: Mojo.Widget.steModeTitleCase, enterSubmits: false },
								this.titleModel = {value: this.title});
	this.controller.setupWidget("feedEnabled",
    							{ property: "value", trueLabel: $L("Yes"), falseLabel: $L("No")}, 
         						this.enabledModel = {value: this.enabled, disabled: false});
        
	this.controller.setupWidget("okButton",
								{type: Mojo.Widget.activityButton},
								this.okButtonModel = {label: $LL("OK"), disabled: false});
       
	this.okButton = this.controller.get("okButton");
	this.controller.listen("okButton", Mojo.Event.tap, this.updateFeed.bindAsEventListener(this));
          
	this.controller.setupWidget("cancelButton",
								{type: Mojo.Widget.defaultButton},
								{label: $LL("Cancel"), disabled: false});
	this.controller.listen("cancelButton", Mojo.Event.tap, this.widget.mojo.close);
	
	if (this.feed === null) {
		this.controller.get("addfeed-title").update($L("Add new Feed"));
	} else {
		this.controller.get("addfeed-title").update($L("Edit Feed"));
	}
	this.controller.get("feedEnabled-title").update($L("Activate Feed"));
	this.controller.get("feedURL-title").update($L("URL"));
	this.controller.get("feedTitle-title").update($L("Title"));
};

AddfeedAssistant.prototype.cleanup = function(event) {
};

AddfeedAssistant.prototype.updateFeed = function() {
    var url = this.urlModel.value;
	var title = this.titleModel.value;
	 
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
		FeedReader.feeds.editFeed(this.index, title, url, this.enabledModel.value);
		this.okButton.mojo.deactivate();
		this.widget.mojo.close();	
	} else {
		FeedReader.feeds.addFeed(title, url, this.enabledModel.value);
		this.okButton.mojo.deactivate();
		this.widget.mojo.close();
	}
}; 
