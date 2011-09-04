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
	name:		"FeedList",
	kind:		"ListViewSkeleton",

	feedState:		[],
	
	events:		{
		onFeedSelected:	"",
		onFeedDeleted:	"",
		onAddFeed:		"",
		onEditFeed:		""
	},
	
	components:	[{
		kind:		"ViewHeader",
		name:		"Header",
		title:		$L("Feed Subscriptions"),
	}, {
			kind:					"EnhancedList",
			name:					"list",
			reorderable:			true,
			dragBackgroundColor:	"rgb(200, 200, 200)",
			dragOpacity:			0.7,
			flex:					1,
			
			onSetupRow:		"setupFeed",
			onAcquirePage:	"acquirePage",
			onDiscardPage:	"discardPage",
			onReorder:		"reorderFeed",
			
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
			kind:		"ToolButton",
			icon:		"../../images/toolbars/icon-sync.png",
			onclick:	"refreshClicked"
		}]
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
		
		this.$.feedTitle.setContent(enyo.application.feeds.getFeedTitle(feed));
		this.$.feedURL.setContent(enyo.application.feeds.getFeedURL(feed));
		this.$.feedIcon.setSrc("../../" + enyo.application.feeds.getFeedIcon(feed));
		
		this.$.unreadCount.setContent(feed.numUnRead);
		this.$.newCount.setContent(feed.numNew);
		
		return true;
	},
	
	acquireData: function(filter, offset, count, inserter) {
		enyo.application.feeds.getFeeds(filter, offset, count, inserter);
	},
	
	reorderFeed: function(sender, fromIndex, toIndex) {
		enyo.application.feeds.moveFeed(fromIndex, toIndex);
	},
	
	itemClicked: function(sender, event) {
		this.inherited(arguments);
		this.doFeedSelected(this.items[event.rowIndex]);
	},
	
	editFeedClicked: function(sender, event) {
		this.doEditFeed(this.items[event.rowIndex]);
		event.stopPropagation();
	},
	
	itemDeleted: function(sender, index) {
		if(this.inherited(arguments)) {
			this.doFeedSelected(null);
		}
		this.doFeedDeleted(this.items[index]);
		enyo.application.feeds.deleteFeed(this.items[index]);
	},
	
	setFeedSpinner: function(index, state) {
		this.$.list.prepareRow(index);
		this.$.feedSpinner.setShowing(state);
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
		if((index < 0) || (index >= this.items.length) || (!this.items[index])) {
			return;
		}
		
		this.setFeedSpinner(index, state);
//		{ enyo.asyncMethod(this, "startSpinner", inIndex, state); } },
	}
});