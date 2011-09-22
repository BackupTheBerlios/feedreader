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
		transitionKind: "enyo.transitions.LeftRightFlyin",
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
			name:					"scrim",
			kind:					"ScrimSpinner"
		}, {
			name:					"preferences",
			kind:					"Preferences",
			onPrefsSaved:			"prefsSaved"
		}, {
			name:					"feedImporter",
			kind:					"FeedImporter",
			onBackClick:			"importerClosed"
		}]
	}, {
		name:					"errorDialog",
		kind:					"ErrorDialog"
	}, {
		name:					"licenseDialog",
		kind:					"LicenseDialog"
	}, {
		name:					"helpDialog",
		kind:					"HelpDialog"
	}, {
		name:					"editFeedDialog",
		kind:					"EditFeedDialog",
		onFeedSaved:			"feedSaved"
	}, {
		kind:					"AppMenu",
		components:				[{
			kind:				"EditMenu"
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
		onWindowRotated:		"optimizeSpace",
		onUnload:				"unloaded"
	}],

	//
	// FeedList events
	//

	feedSelected: function(sender, feed) {
		enyo.asyncMethod(this, function() {
			var selectedFeed = this.$.storyList.getFeed();
			if(selectedFeed && feed && (selectedFeed.id == feed.id)) {
				this.$.storyList.setIsRefresh(true);
			} else {
				this.$.storyView.setStory(null);
			}

			this.$.storyList.setFeed(feed);
			this.$.storyView.setFeed(feed);


			this.optimizeSpace();
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
			if(selectedStory && story && (selectedStory.id == story.id)) {
				this.$.storyView.setIsRefresh(true);
			} else {
				var orientation = enyo.getWindowOrientation();
				if(story && ((orientation == "left") || (orientation == "right"))) {
					this.$.mainPane.selectViewByIndex(1);
				}
			}
			this.$.storyView.setStory(story);
			this.optimizeSpace();
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

	openImporter: function() {
		enyo.asyncMethod(this, function() {
			this.$.feedImporter.reInitialize();
			this.$.outerPane.selectViewByName("feedImporter");
		});
	},

	openHelp: function() {
		enyo.asyncMethod(this, function() {
			this.$.helpDialog.openAtCenter();
		});
	},

	openLicense: function() {
		enyo.asyncMethod(this, function() {
			this.$.licenseDialog.openAtCenter();
		});
	},

	//
	// Edit feed events
	//

	feedSaved: function() {
		this.$.storyView.refresh();
	},

	//
	// Prefs events
	//

	prefsSaved: function() {
		enyo.asyncMethod(this, function() {
			this.$.feedList.refresh();
			this.$.storyList.refresh();
			this.$.storyView.refresh();
			this.$.outerPane.back();
		});
	},

	//
	// Importer events
	//

	importerClosed: function() {
		enyo.asyncMethod(this, function() {
			this.$.feedList.refresh();
			this.$.storyList.refresh();
			this.$.storyView.refresh();
			this.$.outerPane.back();
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

	optimizeSpace: function() {
		if((window.innerWidth < window.innerHeight) &&
		   (this.$.storyView.getStory())) {
			this.$.storyContainer.setMinWidth("448px");
		} else {
			this.$.storyContainer.setMinWidth("");
		}
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
		this.$.feedList.refresh();
	},

	notifyStoryListChanged: function() {
		this.$.storyList.refresh();
	},

	notifySpoolerRunningChanged: function(state) {
		this.$.feedList.spoolerRunningChanged(state);
		this.$.storyList.spoolerRunningChanged(state);
	},

	showError: function(errorMsg, data) {
		var msg = errorMsg;
		if(data !== undefined) {
			msg = enyo.macroize(msg, data);
		}

		enyo.asyncMethod(this, function() {
			this.$.errorDialog.openAtCenter(msg);
		});
	},

	//
	// Initialization
	//

	create: function() {
		this.inherited(arguments);

		enyo.keyboard.setResizesWindow(false);
		this.optimizeSpace();
	}
});
