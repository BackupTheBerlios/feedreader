/*
 *		source/feedlist/feedlist.js
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
	name:			"FeedList",
	kind:			"ListViewSkeleton",

	menuIndex:		0,
	spinningIndex:	-1,

	events:		{
		onFeedSelected:	"",
		onFeedDeleted:	"",
		onAddFeed:		"",
		onEditFeed:		""
	},

	components:	[{
		kind:		"Toolbar",
		name:		"header",
		className:	"enyo-toolbar-light",
		content:	$L("Feed Subscriptions")
	}, {
		kind:					"EnhancedList",
		name:					"list",
		reorderable:			true,
		dragBackgroundColor:	"rgb(200, 200, 200)",
		dragOpacity:			0.7,
		flex:					1,

		onSetupRow:			"setupFeed",
		onAcquirePage:		"acquirePage",
		onDiscardPage:		"discardPage",
		onFinishReAcquire:	"finishReAcquire",
		onReorder:			"reorderFeed",

		components: [{
			kind: 		"SwipeableItem",
			name:		"item",
			onclick:	"itemClicked",
			onConfirm:	"itemDeleted",
			components:	[{
				kind:		"HFlexBox",
				components:	[{
					name:		"feedInfoBox",
					nodeTag:	"div",
					className:	"feed-infobox",
					components:	[{
						kind:	"Image",
						name:	"feedIcon",
						src:	"../../images/lists/icon-rss.png",
						style:	"max-width: 40px; max-height: 40px;"
					}, {
						kind:	"Spinner",
						name:	"feedSpinner",
						style:	"position: absolute; left: 4px; top: 5px; z-index: 10000000"
					}, {
						name:		"unreadItemBadge",
						className:	"feed-unreaditem",
						components:	[{
							name:		"unreadCount",
							className:	"feed-countlabel",
							content:	"0"
						}]
					}, {
						name:		"newCountBadge",
						className:	"feed-newitem",
						components:	[{
							name:		"newCount",
							className:	"feed-countlabel",
							content:	"0"
						}]
					}]
				}, {
					kind:	"VFlexBox",
					flex:	1,
					components: [{
						name:		"feedTitle",
						className:	"feed-title"
					}, {
						name:		"feedURL",
						className:	"feed-url"
					}]
				}, {
					kind:		"IconButton",
					icon:		"../../images/lists/icon-edit.png",
					onclick:	"editFeedClicked"
				}]
			}]
		}]
	}, {
		kind:		"Toolbar",
		pack:		"justify",
		components:	[{
			kind:		"ToolButton",
			icon:		"../../images/toolbars/icon-new.png",
			onclick:	"addFeedClicked"
		}, {
			kind:		"Spacer"
		}, {
			name:		"refreshButton",
			kind:		"ToolButton",
			icon:		"../../images/toolbars/icon-sync.png",
			onclick:	"refreshClicked"
		}]
	}, {
		name:	"feedMenu",
		kind:	"EnhancedMenu"
	}],

	//
	// List handling
	//

	setupFeed: function(sender, index) {
		if((index < 0) || (index >= this.items.length) || (!this.items[index])) {
			return false;
		}

		var feed = this.items[index];

		this.$.item.setSwipeable((feed.feedType != feedTypes.ftAllItems) &&
								 (feed.feedTypr != feedTypes.ftStarred));

		this.$.feedTitle.applyStyle("color", enyo.application.prefs.getCSSTitleColor());
		this.$.feedTitle.applyStyle("font-size", enyo.application.prefs.largeFont ? "20px" : "18px");
		this.$.feedTitle.setContent(enyo.application.feeds.getFeedTitle(feed));
		this.$.feedURL.applyStyle("font-size", enyo.application.prefs.largeFont ? "16px" : "14px");
		this.$.feedURL.setContent(enyo.application.feeds.getFeedURL(feed));
		this.$.feedIcon.setSrc("../../" + enyo.application.feeds.getFeedIcon(feed));

		this.$.unreadCount.setContent(feed.numUnRead);
		this.$.newCount.setContent(feed.numNew);

		return true;
	},

	acquireData: function(filter, offset, count, inserter) {
		enyo.application.feeds.getFeeds(filter, offset, count, inserter);
	},

	reorderFeed: function(sender, toIndex, fromIndex) {
		this.log("REORDER> from", fromIndex, "to", toIndex);
		enyo.application.feeds.moveFeed(fromIndex, toIndex);
	},

	finishReAcquire: function(sender) {
		if(this.selectedIndex >= 0) {
			this.doFeedSelected(this.items[this.selectedIndex]);
		}
	},

	itemClicked: function(sender, event) {
		if(this.inherited(arguments)) {
			this.doFeedSelected(this.items[event.rowIndex]);
		}
	},

	editFeedClicked: function(sender, event) {
		// Store the menu index.
		this.menuIndex = event.rowIndex;

		// Build the menu items.
		var feed = this.items[event.rowIndex];
		var items = new Array({
			caption:	$L("Mark all stories read"),
			onclick:	"menuMarkAllRead"
		}, {
			caption:	$L("Mark all stories unread"),
			onclick:	"menuMarkAllUnRead"
		}, {
			caption:	$L("Unstar all stories"),
			onclick:	"menuMarkAllUnStarred"
		});

		if((feed.feedType != feedTypes.ftStarred) && (feed.feedType != feedTypes.ftAllItems)) {
			items.push({
				caption:	$L("Edit feed settings"),
				onclick:	"menuEditFeed"
			}, {
				caption:	$L("Delete feed"),
				onclick:	"menuDeleteFeed"
			});
		}
		items.push({
			caption:	$L("Update feed"),
			onclick:	"menuUpdateFeed"
		});

		this.$.feedMenu.setItems(items);
		this.$.feedMenu.openAtEvent(event);

		return true;
	},

	itemDeleted: function(sender, index) {
		if(this.inherited(arguments)) {
			this.doFeedSelected(null);
		}
		this.doFeedDeleted(this.deletedItem);
		enyo.application.feeds.deleteFeed(this.deletedItem);
		this.deletedItem = null;
	},

	setFeedSpinner: function(index, state) {
		if(state && (this.spinningIndex >= 0) && (this.spinningIndex != index)) {
			this.setFeedSpinner(this.spinningIndex, false);
			enyo.nextTick(this, this.setFeedSpinner, index, state);
			return;
		}
		this.$.list.prepareRow(index);
		this.$.feedSpinner.setShowing(state);
		this.spinningIndex = state ? index : -1;
	},

	//
	// Menu handling
	//

	menuMarkAllRead: function(sender, event) {
		enyo.application.feeds.markAllRead(this.items[this.menuIndex]);
	},

	menuMarkAllUnRead: function(sender, event) {
		enyo.application.feeds.markAllUnRead(this.items[this.menuIndex]);
	},

	menuMarkAllUnStarred: function(sender, event) {
		enyo.application.feeds.markAllUnStarred(this.items[this.menuIndex]);
	},

	menuEditFeed: function(sender, event) {
		this.doEditFeed(this.items[this.menuIndex]);
	},

	menuUpdateFeed: function(sender, event) {
		enyo.application.feeds.enqueueUpdate(this.items[this.menuIndex]);
	},

	menuDeleteFeed: function(sender, event) {
		this.itemDeleted(sender, event.rowIndex);
	},

	//
	// Toolbar handling
	//

	addFeedClicked: function(sender, event) {
		this.doAddFeed();
	},

	refreshClicked: function(sender, event) {
		enyo.application.feeds.enqueueUpdateAll();
	},

	//
	// Database interaction
	//

	updateCount: function(setter) {
		enyo.application.feeds.getFeedCount(this.filter, setter);
	},

	//
	// Public functions
	//

	setFeedUpdateState: function(state, index) {
		if((index < 0) || (index >= this.items.length)) {
			return;
		}
		this.setFeedSpinner(index, state);
		if(!state) {
			this.refresh();
		}
	},

	spoolerRunningChanged: function(state) {
		this.$.refreshButton.setDisabled(state);
	}
});
