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
	name:		"mainView",
	kind:		"Control",

	components: [{
		name:			"outerPane",
		kind:			"Pane",
		transitionKind: "enyo.transitions.Fade",
		style:			"width:100%; height:100%;",

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
			name:					"preferences",
			kind:					"Preferences",
			onPrefsSaved:			"prefsSaved"
		}, {
			name:					"editFeedDialog",
			kind:					"EditFeedDialog"
		}, {
			name:					"scrim",
			kind:					"ScrimSpinner"
		}]
	}, {
		kind:					"ErrorDialog",
		name:					"errorDialog"
	}, {
		kind:					"AppMenu",
		components:				[{
			kind:				"EditMenu"
		}, {
			caption:			$L("About FeedReader"),
			onclick:			"openAbout"
		}, {
			caption:			$L("License"),
			onclick:			"openLicense"
		}, {
			caption:			$L("Import feeds"),
			onclick:			"openImporter"
		}, {
			caption:			$L("Preferences"),
			onclick:			"openPrefs"
		}, {
			caption:			$L("Help"),
			onclick:			"openHelp"
		}]
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
		enyo.asyncMethod(this, function() {
			var selectedFeed = this.$.storyList.getFeed();
			if(selectedFeed && (selectedFeed.id == feed.id)) {
				this.$.storyList.setIsRefresh(true);
			}

			this.$.storyList.setFeed(feed);
			this.$.storyView.setFeed(feed);
		});
	},

	feedDeleted: function(sender, feed) {
		enyo.asyncMethod(this, function() {
			var selectedFeed = this.$.storyList.getFeed();
			if(selectedFeed && (selectedFeed.id == feed.id)) {
				// Reset story list.
				this.$.storyList.setFeed(null);

				// Reset story view.
				this.$.storyView.setFeed(null);
				this.$.storyView.setStory(null);
			}
		});
	},

	addFeed: function(sender) {
		enyo.asyncMethod(this, function() {
			this.$.editFeedDialog.openAtCenter(null);
		});
	},

	editFeed: function(sender, feed) {
		enyo.asyncMethod(this, function() {
			this.$.editFeedDialog.openAtCenter(feed);
		});
	},

	//
	// StoryList events
	//

	storySelected: function(sender, story) {
		enyo.asyncMethod(this, function() {
			var selectedStory = this.$.storyView.getStory();
			if(selectedStory && (selectedStory.id == story.id)) {
				this.$.storyView.setIsRefresh(true);
			} else {
				var orientation = enyo.getWindowOrientation();
				if(story && ((orientation == "left") || (orientation == "right"))) {
					this.$.mainPane.selectViewByIndex(1);
				}
			}
			this.$.storyView.setStory(story);
		});
	},

	//
	// App menu events
	//

	openPrefs: function() {
		enyo.asyncMethod(this, function() {
			this.$.outerPane.selectViewByName("preferences");
		});
	},

	openAbout: function() {
		enyo.asyncMethod(this, function() {
		});
	},

	openImporter: function() {
		enyo.asyncMethod(this, function() {
		});
	},

	openHelp: function() {
		enyo.asyncMethod(this, function() {
		});
	},

	openLicense: function() {
		enyo.asyncMethod(this, function() {
		});
	},

	//
	// Prefs events
	//

	prefsSaved: function() {
		enyo.asyncMethod(this, function() {
			this.$.feedList.refresh();
			this.$.storyList.refresh();
			this.$.storyView.refresh();
			this.$.outerPane.selectViewByName("mainPane");
		});
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
			this.$.scrim.render();
		} else {
			this.notifyDBReady();
		}

		enyo.application.launcher.closeDashboard();
	},

	windowDeActivated: function() {
		this.log("DE-ACTIVATED");
		enyo.application.isActive = false;
	},

	unloaded: function() {
		if(!enyo.application.updateDashboardVisible){
			enyo.application.launcher.closeDashboard();
		}
		enyo.application.spooler.aboutToClose();
		enyo.application.mainView = undefined;
	},

	//
	// Notifications
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
