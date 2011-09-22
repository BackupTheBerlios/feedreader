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
		onStorySelected:	"",
		onStoryDeleted:		""
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
				name:		"feedDivider",
				kind:		"Divider"
			}, {
				name:		"timeDivider",
				kind:		"Divider"
			}, {
				name:		"item",
				kind: 		"SwipeableItem",
				onConfirm:	"itemDeleted",
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
					className:	"story-title",
					allowHtml:	true
				}, {
					name:		"storyText",
					nodeTag:	"div",
					className:	"story-content",
					allowHtml:	true
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
			name:		"sortButton",
			kind:		"ToolButton",
			icon:		"../../images/toolbars/icon-settings.png",
			onclick:	"sortClicked"
		}, {
			name:		"shareButton",
			kind:		"ToolButton",
			icon:		"../../images/toolbars/icon-share.png",
			onclick:	"shareClicked"
		}, {
			name:		"searchButton",
			kind:		"ToolButton",
			icon:		"../../images/toolbars/icon-search.png",
			onclick:	"searchClicked"
		}, {
			name:		"refreshButton",
			kind:		"ToolButton",
			icon:		"../../images/toolbars/icon-sync.png",
			onclick:	"refreshClicked"
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
	}, {
		name:				"sortMenu",
		kind:				"EnhancedMenu",
		autoCloseSubItems:	false
	}],

	//
	// List handling
	//

	setupStory: function(sender, index) {
		if((index < 0) || (index >= this.items.length) || (!this.items[index])) {
			return false;
		}

		// Every item is deleable.
		this.$.item.setSwipeable(true);

		// Make the story easily available.
		var story = this.items[index];

		// If necessary, shorten the summary.
		var summary = "";
		if(this.feed.showListSummary) {
			var summaryLength = parseInt(enyo.application.prefs.summaryLength, 10);
			summary = enyo.application.feeds.getStoryFormatter().stripHTML(story.summary);
			if(summary.length > (summaryLength + 10)) {
				summary = summary.slice(0, summaryLength - 1) + "...";
			}
		}

		// Set the contents.
		this.$.storyTitle.setContent(this.feed.showListCaption ? story.title : "");
		this.$.storyText.setContent(this.feed.showListSummary ? summary : "");
		this.$.starButton.setChecked(story.isStarred);

		this.$.storyTitle.applyStyle("color", enyo.application.prefs.getCSSTitleColor());
		this.$.storyTitle.applyStyle("font-weight", story.isRead ? "normal" : "bold");

		this.$.storyDate.applyStyle("font-size", enyo.application.prefs.largeFont ? "14px" : "12px");
		this.$.storyTitle.applyStyle("font-size", enyo.application.prefs.largeFont ? "18px" : "16px");
		this.$.storyText.applyStyle("font-size", enyo.application.prefs.largeFont ? "17px" : "15px");

		// Set the feedDivider.
		var feedTitle = "";
		this.$.feedDivider.canGenerate = false;
		if((this.feed.feedType == feedTypes.ftAllItems) ||
		   (this.feed.feedType == feedTypes.ftStarred)) {
			if((this.feed.sortMode & 0x0100) != 0x0100) {
				if((index == 0) ||
				   (this.items[index].fid != this.items[index - 1].fid)) {

					this.log(enyo.json.stringify(story));
					this.$.feedDivider.setCaption(enyo.application.feeds.getFeedTitle({
						feedType:	story.feedType,
						title:		story.feedTitle
					}));
					this.$.feedDivider.canGenerate = true;
				}
			} else {
				feedTitle = enyo.application.feeds.getFeedTitle({
					feedType:	story.feedType,
					title:		story.feedTitle
				}) + ', ';
			}
		}

		// Set the timeDivider.
		this.$.timeDivider.canGenerate = false;
		if((index == 0) ||
		   (!enyo.application.feeds.getDateFormatter().datesEqual(this.items[index].pubdate, this.items[index - 1].pubdate))) {
			this.$.timeDivider.setCaption(enyo.application.feeds.getDateFormatter().formatDate(story.pubdate));
			this.$.timeDivider.canGenerate = true;
			dividerShown = true;
		}

		if(this.$.feedDivider.canGenerate || this.$.timeDivider.canGenerate) {
			this.$.item.applyStyle("border-top", "none;");
		} else {
			this.$.item.applyStyle("border-top", "1px solid #EEEEEE;");
		}

		this.$.storyDate.setContent(feedTitle + enyo.application.feeds.getDateFormatter().formatTime(story.pubdate));

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
		this.inherited(arguments);
		if(this.selectedIndex >= 0) {
			this.doStorySelected(this.items[this.selectedIndex]);
		}
	},

	itemDeleted: function(sender, index) {
		if(this.inherited(arguments)) {
			this.doStorySelected(null);
		}
		this.doStoryDeleted(this.deletedItem);
		enyo.application.feeds.deleteStory(this.deletedItem);
		this.deletedItem = null;
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
	// Ordering and filtering
	//

	sortClicked: function(sender, event) {
		var visibleItems = [{
			kind:		"MenuCheckItem",
			caption:	$L("Show all stories"),
			checked:	(this.feed.sortMode & 0x00FF) == 0,
			onclick:	"showAll"
		}, {
			kind:		"MenuCheckItem",
			caption:	$L("Show only unread stories"),
			checked:	(this.feed.sortMode & 0x00FF) == 1,
			onclick:	"showUnRead"
		}, {
			kind:		"MenuCheckItem",
			caption:	$L("Show only new stories"),
			checked:	(this.feed.sortMode & 0x00FF) == 2,
			onclick:	"showNew"
		}];

		var items = undefined;
		if((this.feed.feedType == feedTypes.ftAllItems) ||
		   (this.feed.feedType == feedTypes.ftStarred)) {
			items = [{
				kind:		"MenuItem",
				caption:	$L("Visible stories"),
				open:		true,
				components:	visibleItems
			}, {
				kind:		"MenuItem",
				caption:	$L("Ordering"),
				open:		true,
				components:	[{
					kind:		"MenuCheckItem",
					caption:	$L("Order by feed"),
					checked:	(this.feed.sortMode & 0x0100) == 0,
					onclick:	"orderToggled"
				}, {
					kind:		"MenuCheckItem",
					caption:	$L("Order by date"),
					checked:	(this.feed.sortMode & 0x0100) != 0,
					onclick:	"orderToggled"
				}]
			}]
		}

		this.$.sortMenu.setItems(items || visibleItems);
		this.$.sortMenu.openAtEvent(event);
	},

	setSortMode: function(value) {
		this.feed.sortMode = value;
		enyo.application.feeds.setSortMode(this.feed);
		this.refresh();
	},

	showAll: function() {
		this.setSortMode((this.feed.sortMode & 0xFF00) | 0);
	},

	showUnRead: function() {
		this.setSortMode((this.feed.sortMode & 0xFF00) | 1);
	},

	showNew: function() {
		this.setSortMode((this.feed.sortMode & 0xFF00) | 2);
	},

	orderToggled: function() {
		this.setSortMode(this.feed.sortMode ^ 0x0100);
	},

	searchClicked: function() {

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
		enyo.application.feeds.getFeedURLList(this.feed, function(urls) {
			var text = '';
			for(i = 0; i < urls.length; i++) {
				text += '<li><a href="' + urls[i].url + '">' + urls[i].title + '</a></li>';
			}
			enyo.application.openEMail($L("Check out these stories"),
									'<ul>' + text + '</ul>');
		});
	},

	shareViaIM: function(sender, email) {
		enyo.application.feeds.getFeedURLList(this.feed, function(urls) {
			var text = $L("Check out these stories") + ': ' + urls[0].url;
			for(i = 1; i < urls.length; i++) {
				text += ', ' + urls[i].url;
			}
			enyo.application.openMessaging(text);
		});
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

		this.$.sortButton.setDisabled(feedInvalid);
		this.$.refreshButton.setDisabled(enyo.application.spooler.actionRunning || feedInvalid || !this.feed.enabled);
		this.$.shareButton.setDisabled(feedInvalid);
		this.$.searchButton.setDisabled(feedInvalid);

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

	spoolerRunningChanged: function(state) {
		this.$.refreshButton.setDisabled(state || !this.feed || !this.feed.enabled);
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
