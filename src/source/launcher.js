/*
 *		source/launcher.js - Application launcher
 *
 * The classes defined here communicate with the FeedReader SQLite
 * database. It does not contain the migration code used to migrate
 * the older Depot-based database into the current structure.
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

	name:	"FeedReaderAppLauncher",
	kind:	"Component",

	components: [{
		kind: 					"ApplicationEvents",
		onApplicationRelaunch:	"relaunch",
		onUnload:				"cleanup"
	}, {
		name:					"appMgr",
		kind: 					"PalmService",
		service:				"palm://com.palm.applicationManager/",
		method:					"launch",
		subscribe:				true
	}],

	cleanup: function() {
		enyo.application.prefs.save();
		this.log("FEEDREADER> exiting NOW");
	},

	startup: function() {
		// Set some globals.
		enyo.application.appName 		= "FeedReader";
		enyo.application.appAuthor 		= "Timo Tegtmeier";
		enyo.application.versionString 	= "3.0.0";
		enyo.application.versionInt 	= 22;
		enyo.application.copyrightYears	= "2009-2011";

		enyo.application.notifyFeedUpdated = enyo.bind(this, this.notifyFeedUpdated);
		enyo.application.notifyDBReady = enyo.bind(this, this.notifyDBReady);
		enyo.application.notifyFeedListChanged = enyo.bind(this, this.notifyFeedListChanged);
		enyo.application.notifyStoryListChanged = enyo.bind(this, this.notifyStoryListChanged);

		enyo.application.assert = enyo.bind(this, this.assert);
		enyo.application.showError = enyo.bind(this, this.showError);
		enyo.application.openLink = enyo.bind(this, this.openLink);
		enyo.application.openEMail = enyo.bind(this, this.openEMail);
		enyo.application.openMessaging = enyo.bind(this, this.openMessaging);
		enyo.application.nop = function() {};

		// Create the necessary helper objects.
		enyo.application.connChecker = new ConnectionChecker();
		enyo.application.spooler = new Spooler();
		enyo.application.ril = new RILService();

		// Load preferences
		enyo.application.prefs = new Prefs();
		enyo.application.prefs.load();

		// Create the timer
		enyo.application.timer = new Timer();
		enyo.application.timer.setTimer();

		// Create the feeds object
		enyo.application.feeds = new Feeds();

		// Create the database
		enyo.application.db = new Database();

		// Launch the application
		enyo.application.launcher.relaunch(this);
	},

	relaunch: function(sender) {
		var params = enyo.windowParams;

		this.log("LAUNCHER> params", params);

 		if(params.action) {
			switch(params.action) {
				case "feedUpdate":
					enyo.application.feeds.enqueueUpdateAll();
					break;

				case "bannerPressed":
					this.log("LAUNCHER> banner has been pressed");
					break;
			}
		} else {
			this.openCard("mainview", "FeedReaderMainView", params);
		}
		return true;
	},

	openCard: function(name, windowName, windowParams) {
		var cardPath = "source/" + name + "/index.html";
		return enyo.windows.activate(cardPath, windowName, windowParams);
	},

	notifyFeedUpdated: function(state, index) {
		if(enyo.application.mainView) {
			enyo.application.mainView.notifyFeedUpdated(state, index);
		}
	},

	notifyDBReady: function() {
		if(enyo.application.mainView) {
			enyo.application.mainView.notifyDBReady();
		}
	},

	notifyFeedListChanged: function() {
		if(enyo.application.mainView) {
			enyo.application.mainView.notifyFeedListChanged();
		}
	},

	notifyStoryListChanged: function() {
		if(enyo.application.mainView) {
			enyo.application.mainView.notifyStoryListChanged();
		}
	},

	showError: function(errorMsg, data) {
		if(enyo.application.mainView) {
			enyo.application.mainView.showError(errorMsg, data);
		}
	},

	assert: function(check, msg) {
		if(check) {
			return;
		}
		throw "Assertion failed: " + msg;
	},

	openLink: function(url) {
		this.$.appMgr.call({
			id:		"com.palm.app.browser",
			params:	{
				target: url
			}
		});
	},

	openEMail: function() {

	},

	openMessaging: function() {

	}
});
