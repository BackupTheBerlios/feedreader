/*
 *		source/editfeed/editfeed.js
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

enyo.kind({
	name:			"EditFeedDialog",
	kind:			"ModalDialog",
	layoutKind:		"VFlexLayout",
	contentHeight:	"100%",
	style:			"width: 500px; height: 85%; min-height: 500px;",

	events:	{
		onFeedSaved:	"",
		onCanceled:		""
	},

	published:	{
		feed:			null
	},

	components:	[{
		kind:		"Scroller",
		className:	"group",
		flex:		1,
		components:	[{
			kind:		"RowGroup",
			caption:	$L("Basic settings"),
			components:	[{
				name:			"url",
				kind:			"Input",
				autoCapitalize:	"lowercase",
				inputType:		"url",
				hint:			$L("URL of RSS/ATOM Feed...")
			}, {
				name:		"name",
				kind:		"Input",
				hint:		$L("Feed name...")
			}, {
				name:		"activateFeed",
				kind:		"ToggleItem",
				caption:	$L("Activate Feed"),
				value:		true
			}]
		}, {
			kind:		"RowGroup",
			caption:	$L("Credentials"),
			components:	[{
				name:	"username",
				kind:	"Input",
				hint:	$L("User name")
			}, {
				name:	"password",
				kind:	"PasswordInput",
				hint:	$L("Password")
			}]
		}, {
			kind:		"RowGroup",
			caption:	$L("Story list display"),
			components:	[{
				name:	"listMode",
				kind:	"SelectorItem",
				items:	[{
					caption:	$L("Captions and summaries"),
					value:		0
				}, {
					caption:	$L("Only captions"),
					value:		1
				}, {
					caption:	$L("Only summaries"),
					value:		2
				}],
				caption:	$L("Show")
			}, {
				name:	"sortMode",
				kind:	"SelectorItem",
				items:	[{
					caption:	$L("Show all stories"),
					value:		0
				}, {
					caption:	$L("Show only unread stories"),
					value:		1
				}, {
					caption:	$L("Show only new stories"),
					value:		2
				}],
				caption:	$L("Filter")
			}]
		}, {
			kind:		"RowGroup",
			caption:	$L("Story display"),
			components:	[{
				name:	"detailMode",
				kind:	"SelectorItem",
				items:	[{
					caption:	$L("Show story"),
					value:		0
				}, {
					caption:	$L("Show webpage"),
					value:		1
				}],
				caption:	$L("Show"),
				onChange:	"detailModeChanged"
			}, {
				name:		"showPicture",
				kind:		"ToggleItem",
				caption:	$L("Show story picture"),
				value:		true
			}, {
				name:		"showMedia",
				kind:		"ToggleItem",
				caption:	$L("Show story media"),
				value:		true
			}, {
				name:		"allowHTML",
				kind:		"ToggleItem",
				caption:	$L("Render HTML"),
				value:		true
			}]
		}]
	}, {
		name:		"saveButton",
		kind:		"ActivityButton",
		className:	"enyo-button-affirmative",
		caption:	$L("Save"),
		onclick:	"saveClicked"
	}, {
		name:		"cancelButton",
		kind:		"Button",
		className:	"enyo-button-negative",
		style:		"margin-bottom: 20px",
		caption:	$L("Cancel"),
		onclick:	"cancelClicked"
	}],

	create: function() {
		this.inherited(arguments);

		this.updateSuccess = enyo.bind(this, this.updateSuccess);
		this.updateFailed = enyo.bind(this, this.updateFailed);
	},

	saveClicked: function() {
		if(!this.$.url.getValue || (this.$.url.getValue().length <= 0)) {	// In case no url is entered, simply exit the scene.
			this.doCanceled();
			this.close();
			return;
		}

		// Update the UI.
		this.$.saveButton.setActive(true);
		this.$.saveButton.setCaption(this.adding ? $L("Adding Feed...") : $L("Updating Feed..."));
		this.$.saveButton.setDisabled(true);

		// Update the feed object.
		this.feed.url = this.$.url.getValue();
		this.feed.title = this.$.name.getValue();
		this.feed.enabled = this.$.activateFeed.getValue();

		this.feed.username = this.$.username.getValue();
		this.feed.password = this.$.password.getValue();

		this.feed.showListCaption = (this.$.listMode.getValue() == 0) || ((this.$.listMode.getValue() % 2) == 1);
		this.feed.showListSummary = (this.$.listMode.getValue() % 2) == 0;

		this.feed.showDetailCaption = true;
		this.feed.showDetailSummary = true;
		this.feed.fullStory = this.$.detailMode == 0;

		this.feed.showPicture = this.$.showPicture.getValue();
		this.feed.showMedia = this.$.showMedia.getValue();
		this.feed.sortMode = this.$.sortMode.getValue();
		this.feed.allowHTML = this.$.allowHTML.getValue();

		if(/^[a-z]{1,5}:/.test(this.feed.url) === false) {
			this.feed.url = this.feed.url.replace(/^\/{1,2}/, "");
			this.feed.url = "http://" + this.feed.url;
		}

		// Update the entered URL
		this.$.url.setValue(this.feed.url);

		// Save the feed.
		enyo.application.feeds.addOrEditFeed(this.feed, this.updateSuccess, this.updateFailed);
	},

	detailModeChanged: function() {
		var state = this.$.detailMode.getValue() == 1;
		this.log("DETAILMODE CHANGED", state);
		this.$.showPicture.setDisabled(state);
		this.$.showMedia.setDisabled(state);
		this.$.allowHTML.setDisabled(state);
	},

	resetButtons: function() {
		this.$.saveButton.setActive(false);
		this.$.saveButton.setCaption($L("Save"));
		this.$.saveButton.setDisabled(false);
	},

	updateSuccess: function() {
		this.doFeedSaved();
		this.resetButtons();
		this.close();
	},

	updateFailed: function() {
		this.resetButtons();
	},

	cancelClicked: function() {
		this.doCanceled();
		this.close();
	},

	feedChanged: function() {
		if(this.feed == null) {
			this.adding = true;
			this.feed = new Feed();
			this.setCaption($L("Add feed"));
		} else {
			this.adding = false;
			this.setCaption($L("Edit feed"));
		}

		var listMode = 0;
		var detailMode = 0;

		if(this.feed.showListSummary && this.feed.showListCaption) {
			listMode = 0;
		} else if(this.feed.showListCaption) {
			listMode = 1;
		} else if(this.feed.showListSummary) {
			listMode = 2;
		}

		detailMode = this.feed.fullStory ? 0 : 1;

		this.$.name.setValue(this.feed.title);
		this.$.url.setValue(this.feed.url);
		this.$.activateFeed.setValue(this.feed.enabled);

		this.$.username.setValue(this.feed.username);
		this.$.password.setValue(this.feed.password);

		this.$.listMode.setValue(listMode);
		this.$.detailMode.setValue(detailMode);
		this.$.sortMode.setValue(this.feed.sortMode);

		this.$.showPicture.setValue(this.feed.showPicture);
		this.$.showMedia.setValue(this.feed.showMedia);
		this.$.allowHTML.setValue(this.feed.allowHTML);

		this.detailModeChanged();
	},

	openAtCenter: function(feed) {
		this.feed = feed;
		this.inherited(arguments);
		this.feedChanged();
	}
});
