/*
 *		source/storylist/storylist.js
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
	name:			"storyList",
	kind:			"ListViewSkeleton",

	published:	{
		feed:		undefined,
		isRefresh:	false
	},

	events:	{
		onStorySelected:	""
	},

	components:	[{
		kind:		"Toolbar",
		name:		"header",
		className:	"enyo-toolbar-light"
	}, {
			kind:		"EnhancedList",
			name:		"list",
			flex:		1,

			onSetupRow: 		"setupStory",
			onAcquirePage:		"acquirePage",
			onDiscardPage:		"discardPage",
			onFinishReAcquire:	"finishReAcquire",

			showing:	false,

			components: [{
				name:		"divider",
				kind:		"Divider"
			}, {
				name:		"item",
				kind: 		"SwipeableItem",
				onclick:	"itemClicked",
				components:	[{
					name:		"starButton",
					kind:		"StarButton",
					style:		"float: right",
					onChange:	"storyStarred"
				}, {
					name:		"storyDate",
					nodeTag:	"div",
					className:	"story-date"
				}, {
					name:		"storyTitle",
					nodeTag:	"div",
					className:	"story-title"
				}, {
					name:		"storyText",
					nodeTag:	"div",
					className:	"story-content"
				}]
			}]
	}, {
		name:	"bgContainer",
		kind:	"HFlexBox",
		align:	"center",
		pack:	"center",
		flex:	1,

		components:	[{
			name:	"bgImage",
			kind:	"Image",
			src:	"../../images/nodata-background.png"
		}]
	}, {
		kind:		"Toolbar",
		pack:		"justify",
		components:	[{
			kind:		"GrabButton"
		}, {
			kind:		"Spacer"
		}, {
			name:		"editButton",
			kind:		"ToolButton",
			icon:		"../../images/toolbars/icon-edit.png"
		}, {
			name:		"refreshButton",
			kind:		"ToolButton",
			icon:		"../../images/toolbars/icon-sync.png",
			onclick:	"refreshClicked"
		}, {
			name:		"shareButton",
			kind:		"ToolButton",
			icon:		"../../images/toolbars/icon-share.png",
			onclick:	"shareClicked"
		}]
	}, {
		name:			"shareMenu",
		kind:			"Menu",
		components:		[{
			caption:	$L("Send via E-Mail"),
			onclick:	"shareViaEmail"
		}, {
			caption:	$L("Send via SMS/IM"),
			onclick:	"shareViaIM"
		}]
	}],

	//
	// List handling
	//

	setupStory: function(sender, index) {
		if((index < 0) || (index >= this.items.length) || (!this.items[index])) {
			return false;
		}

		var story = this.items[index];

		var summary = "";
		if(this.feed.showListSummary) {
			var summaryLength = parseInt(enyo.application.prefs.summaryLength, 10);
			summary = enyo.application.feeds.getStoryFormatter().stripHTML(story.summary);
			if(summary.length > (summaryLength + 10)) {
				summary = summary.slice(0, summaryLength - 1) + "...";
			}
		}

		this.$.item.setSwipeable(true);
		this.$.storyTitle.setContent(story.title);
		this.$.storyText.setContent(summary);
		this.$.starButton.setChecked(story.isStarred);

		this.$.storyTitle.applyStyle("color", enyo.application.prefs.getCSSTitleColor());
		if(!story.isRead) {
			this.$.storyTitle.applyStyle("font-weight", "bold");
		} else {
			this.$.storyTitle.applyStyle("font-weight", "normal");
		}

		// orderMode!!!!

		if((index == 0) ||
		   (!enyo.application.feeds.getDateFormatter().datesEqual(this.items[index].pubdate, this.items[index - 1].pubdate))) {
			this.$.divider.setCaption(enyo.application.feeds.getDateFormatter().formatDate(story.pubdate));
			this.$.divider.canGenerate = true;
			this.$.item.applyStyle("border-top", "none;");
		} else {
			this.$.divider.setCaption("");
			this.$.divider.canGenerate = false;
			this.$.item.applyStyle("border-top", "1px solid silver;");
		}

		this.$.storyDate.setContent(enyo.application.feeds.getDateFormatter().formatTime(story.pubdate));

		return true;
	},

	acquirePage: function(sender, page) {
		if(this.feed) {
			this.inherited(arguments);
		}
	},

	acquireData: function(filter, offset, count, inserter) {
		enyo.application.feeds.getStories(this.feed, filter, offset, count, inserter);
	},

	finishReAcquire: function(sender) {
		if(this.selectedIndex >= 0) {
			this.doStorySelected(this.items[this.selectedIndex]);
		}
	},

	itemClicked: function(sender, event) {
		this.inherited(arguments);
		this.doStorySelected(this.items[event.rowIndex]);
	},

	storyStarred: function(sender, event) {
		var story = this.items[event.rowIndex];
		story.isStarred = sender.getChecked();
		enyo.application.feeds.markStarred(story);

		if(this.selectedIndex == event.rowIndex) {
			// Refresh the story view.
			this.doStorySelected(story);
		}
	},

	//
	// Toolbar handling
	//

	refreshClicked: function(sender, event) {
		if(this.feed) {
			enyo.application.feeds.enqueueUpdate(this.feed);
		}
	},

	shareClicked: function(sender, event) {
		this.$.shareMenu.openAtEvent(event);
	},

	//
	// Sharing
	//

	shareViaEmail: function(sender, event) {

	},

	shareViaIM: function(sender, email) {

	},

	//
	// Property handling
	//

	feedChanged: function() {
		var feedInvalid = !this.feed;
		if(feedInvalid) {
			this.$.header.setContent($L("Story list"));
		} else {
			this.$.header.setContent(enyo.application.feeds.getFeedTitle(this.feed));
		}

		this.$.list.setShowing(!feedInvalid);
		this.$.bgContainer.setShowing(feedInvalid);

		this.$.editButton.setDisabled(feedInvalid);
		this.$.refreshButton.setDisabled(feedInvalid || !this.feed.enabled);
		this.$.shareButton.setDisabled(feedInvalid);

		if(!this.isRefresh) {
			this.clear();
		} else {
			this.refresh();
		}
		this.isRefresh = false;
	},

	//
	// Database handling
	//

	updateCount: function(setter) {
		enyo.application.feeds.getStoryCount(this.feed, this.filter, setter);
	},

	gotFeed: function(feed) {
		this.feed = feed;
		this.isRefreshing = true;
		this.feedChanged();
	},

	//
	// Public functions
	//

	refresh: function() {
		if(this.feed) {
			this.inherited(arguments);
		}
	},

	//
	// Initialization
	//

	create: function() {
		this.inherited(arguments);

		this.gotFeed = enyo.bind(this, this.gotFeed);

		this.feedChanged();
	}
});
