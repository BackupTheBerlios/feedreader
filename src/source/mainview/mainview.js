/*
 *		source/mainview/mainview.js
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
	name:			"mainView",
	kind:			"Pane",
	transitionKind: "enyo.transitions.Fade",

	components: [{
		kind:	"SlidingPane",
		name:	"mainPane",

		components:	[{
			name:		"feedListContainer",
			width:		"320px",
			fixedWidth:	true,
			components:	[{
				kind:				"FeedList",
				name:				"feedList",
				onFeedSelected:		"feedSelected",
				onFeedDeleted:		"feedDeleted",
				onAddFeed:			"addFeed",
				onEditFeed:			"editFeed"
			}]
		}, {
			name:		"storyListContainer",
			width:		"320px",
			fixedWidth:	true,
			components:	[{
				kind:				"storyList",
				onStorySelected:	"storySelected"
			}]
		}, {
			name:		"storyContainer",
			flex:		1,
			components:	[{
				name:		"storyView",
				kind:		"StoryView",
				flex:		1
			}]
		}]
	}, {
		name:	"editFeedDialog",
		kind:	"EditFeedDialog"
	}, {
		name:					"scrim",
		kind:					"ScrimSpinner"
	}, {
		kind:					"ErrorDialog",
		name:					"errorDialog"
	}, {
		name:					"applicationEvents",
		kind:					"ApplicationEvents",

		onWindowActivated:		"windowActivated",
		onWindowDeactivated:	"windowDeActivated",
		onUnload:				"unloaded"
	}],

	//
	// FeedList events
	//

	feedSelected: function(sender, feed) {
		this.$.storyList.setFeed(feed);
		this.$.storyView.setFeed(feed);

		var selectedFeed = this.$.storyList.getFeed();
		if(selectedFeed && (selectedFeed.id == feed.id)) {
			// Reset story view.
			this.$.storyView.setFeed(null);
			this.$.storyView.setStory(null);
		}
	},

	feedDeleted: function(sender, feed) {
		var selectedFeed = this.$.storyList.getFeed();
		if(selectedFeed && (selectedFeed.id == feed.id)) {
			// Reset story list.
			this.$.storyList.setFeed(null);

			// Reset story view.
			this.$.storyView.setFeed(null);
			this.$.storyView.setStory(null);
		}
	},

	addFeed: function(sender) {
		this.$.editFeedDialog.openAtCenter(null);
	},

	editFeed: function(sender, feed) {
		this.$.editFeedDialog.openAtCenter(feed);
	},

	//
	// StoryList events
	//

	storySelected: function(sender, story) {
		var orientation = enyo.getWindowOrientation();
		this.log("OR>", orientation);
		if(story && ((orientation == "left") || (orientation == "right"))) {
			this.$.mainPane.selectViewByIndex(1);
		}

		this.$.storyView.setStory(story);
	},

	//
	// Application events
	//

	windowActivated: function() {
		this.log("ACTIVATED");
		enyo.application.mainView = this;
		enyo.application.isActive = true;

		if(!enyo.application.db.isReady) {
			this.$.scrim.show();
		} else {
			this.notifyDBReady();
		}
	},

	windowDeActivated: function() {
		this.log("DE-ACTIVATED");
		enyo.application.isActive = false;
	},

	unloaded: function() {
		this.log("UN-LOADED");
		enyo.application.mainView = undefined;
	},

	//
	//
	//

	notifyDBReady: function() {
		this.$.scrim.hide();
		this.$.feedList.refresh();
	},

	notifyFeedUpdated: function(state, index) {
		this.$.feedList.setFeedUpdateState(state, index);
	},

	notifyFeedListChanged: function() {
		this.log("MAINVIEW> feedlist changed");
		this.$.feedList.refresh();
	},

	notifyStoryListChanged: function() {
		this.log("MAINVIEW> storylist changed");
		this.$.storyList.refresh();
	},

	showError: function(errorMsg, data) {
		var msg = errorMsg;
		if(data !== undefined) {
			msg = enyo.macroize(msg, data);
		}

		enyo.nextTick(this, function() {
			this.$.errorDialog.openAtCenter(msg);
		});
	}
});
