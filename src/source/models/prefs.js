/*
 *		source/models/prefs.js - preferences data model
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

	name:					"Prefs",
	kind:					"Component",

	cookieName:				"comtegi-stuffAppFeedReaderPrefs",

	updateInterval:				30,
	storyKeepTime:				24 * 3,
	updateOnStart:				true,
	notificationEnabled:		true,
	blinkingEnabled:			true,
	notifyWhileRunning:			true,
	unobtrusiveNotifications:	true,
	wakingEnabled:				false,
	titleColor:					"black",
	summaryLength: 				120,
	largeFont: 					false,
	leftHanded: 				true,		// not used in enyo version
	enableRotation: 			true,		// not used in enyo version
	showChanges: 				false,

	rilUser: 				"",	// Read it Later
	rilPassword:			"",

	gReaderUser:			"",	// Google Reader
	gReaderPassword:		"",

	timer: 					null,

	constructor: function() {
		this.cookie = enyo.getCookie(this.cookieName);
	},

	load: function() {
		if(this.cookie) {
			var settings = enyo.json.parse(this.cookie);

			this.updateInterval = settings.updateInterval;
			this.notificationEnabled = settings.notificationEnabled;
			this.wakingEnabled = settings.wakingEnabled;

			if(settings.version > 0) {
				this.summaryLength = settings.summaryLength;
				this.titleColor = settings.titleColor;
			}
			if(settings.version > 1) {
				this.largeFont = settings.largeFont;
			}
			if(settings.version > 3) {
				this.leftHanded = settings.leftHanded;
			}
			if(settings.version > 5) {
				this.updateOnStart = settings.updateOnStart;
			}
			if(settings.version > 6) {
				this.blinkingEnabled = settings.blinkingEnabled;
				this.notifyWhileRunning = settings.notifyWhileRunning;
				this.enableRotation = settings.enableRotation;
			}
			if(settings.storyKeepTime !== undefined) {
				this.storyKeepTime = settings.storyKeepTime;
			}
			if(settings.unobtrusiveNotifications !== undefined) {
				this.unobtrusiveNotifications = settings.unobtrusiveNotifications;
			}

			this.rilUser = settings.rilUser || "";
			this.rilPassword = settings.rilPassword || "";
			this.gReaderUser = settings.gReaderUser || "";
			this.gReaderPassword = settings.gReaderPassword || "";

			if(settings.version < enyo.application.versionInt) {
				this.showChanges = true;
				this.save(false);
			}
		}
	},

	save: function(showCredentialsWarning) {
		var settings = enyo.json.stringify({
			version: 					enyo.application.versionInt,
			updateInterval: 			this.updateInterval,
			updateOnStart:				this.updateOnStart,
			notificationEnabled: 		this.notificationEnabled,
			blinkingEnabled:			this.blinkingEnabled,
			notifyWhileRunning:			this.notifyWhileRunning,
			unobtrusiveNotifications:	this.unobtrusiveNotifications,
			wakingEnabled: 				this.wakingEnabled,
			summaryLength: 				this.summaryLength,
			titleColor: 				this.titleColor,
			largeFont:					this.largeFont,
			leftHanded:					this.leftHanded,
			enableRotation:				this.enableRotation,
			storyKeepTime:				this.storyKeepTime,
			rilUser:					this.rilUser,
			rilPassword:				this.rilPassword,
			gReaderUser:				this.gReaderUser,
			gReaderPassword:			this.gReaderPassword
		});
		enyo.setCookie(this.cookieName, settings);
		enyo.application.timer.setTimer();
	}
});
