/*
 *		app/models/prefs.js - preferences data model
 */

/* FeedReader - A RSS Feed Aggregator for Palm WebOS
 * Copyright (C) 2009, 2010 Timo Tegtmeier
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

var prefs = Class.create({
	updateInterval:	30,
	storyKeepTime: 24 * 3,
	updateOnStart: true,
	notificationEnabled: true,
	blinkingEnabled: true,
	notifyWhileRunning: true,
	wakingEnabled: false,
	titleColor: "red",
	summaryLength: 120,
	largeFont: false,
	showChanges: false,
	leftHanded: true,
	enableRotation: true,
	
	timer: {},
	
	initialize: function() {
		this.cookie = new Mojo.Model.Cookie("comtegi-stuffAppFeedReaderPrefs");
		this.setTimerSuccessHandler = this.setTimerSuccess.bind(this);
		this.setTimerFailedHandler  = this.setTimerFailed.bind(this);
	},
	
	load: function() {
		var settings = this.cookie.get();
		if(settings) {
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
			
			if(settings.version < FeedReader.versionInt) {
				this.showChanges = true;
				this.save();
			}
		}
	},
	
	save: function() {
		this.cookie.put({
			version: 				FeedReader.versionInt,
			updateInterval: 		this.updateInterval,
			updateOnStart:			this.updateOnStart,
			notificationEnabled: 	this.notificationEnabled,
			blinkingEnabled:		this.blinkingEnabled,
			notifyWhileRunning:		this.notifyWhileRunning,
			wakingEnabled: 			this.wakingEnabled,
			summaryLength: 			this.summaryLength,
			titleColor: 			this.titleColor,
			largeFont:				this.largeFont,
			leftHanded:				this.leftHanded,
			enableRotation:			this.enableRotation,
			storyKeepTime:			this.storyKeepTime
		});
		this.setTimer();
	},
	
	setTimerSuccess: function(response) {
		Mojo.Log.info("Timer successfully set");
	},
	
	setTimerFailed: function(reponse) {
		Mojo.Log.warn("Unable to set timer:", response);
	},
	
	setTimer: function() {
        if (this.updateInterval > 0) {
			var hours, minutes, seconds;
			if (this.updateInterval >= 1440) {
				hours   = 23;
				minutes = 59;
				seconds = 59;
			} else {
				hours   = parseInt(this.updateInterval / 60, 10);
				minutes = this.updateInterval % 60;
				seconds = 0;
				
				if(hours < 10) {
					hours = "0" + hours;
				}
				if(minutes < 10) {
					minutes = "0" + minutes;
				}
				if(seconds < 10) {
					seconds = "0" + seconds;
				}
			}
			
			var t = new Template("#{h}:#{m}:#{s}");
			
            this.timer = new Mojo.Service.Request("palm://com.palm.power/timeout", {
                method: "set",
                parameters: {
                    "key": "com.tegi-stuff.feedreader.timer",
                    "in": t.evaluate({
						h: hours,
						m: minutes,
						s: seconds
					}),
                    "wakeup": this.wakingEnabled,
                    "uri": "palm://com.palm.applicationManager/open",
                    "params": {
                        "id": "com.tegi-stuff.app.feedreader",
                        "params": {
							"action": "feedUpdate"
						}
                    }
                },
                onSuccess: this.setTimerSuccessHandler,
                onFailure: this.setTimerFailedHandler
            });
        } else {
			this.timer = new Mojo.Service.Request("palm://com.palm.power/timeout", {
				method: "clear",
				parameters: {
					"key": "com.tegi-stuff.feedreader.timer"
				},
				onSuccess: this.setTimerSuccessHandler,
                onFailure: this.setTimerFailedHandler
			});
		}	
	}
});
