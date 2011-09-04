/*
 *		source/models/timer - Timer service wrapper
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

	name:	"Timer",
	kind:	"Component",
	
	key:	"com.tegi-stuff.feedreader.timer",
	
	components:	[{
		name:		"setAlarm",
		kind:		"PalmService",
		service:	"palm://com.palm.power/timeout/",
		onSuccess:	"setTimerSuccess",
		onFailure:	"setTimerFailed",
		subscribe:	true
	}],

	setTimer: function() {
		if(enyo.application.prefs.updateInterval > 0) {
			var hours, minutes, seconds;
			if(enyo.application.prefs.updateInterval >= 1440) {
				hours   = 23;
				minutes = 59;
				seconds = 59;
			} else {
				hours   = parseInt(enyo.application.prefs.updateInterval / 60, 10);
				minutes = enyo.application.prefs.updateInterval % 60;
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
			
			this.$.setAlarm.call({
				"key":		this.key,
				"in":		enyo.macroize("{$h}:{$m}:{$s}", {
					h: hours,
					m: minutes,
					s: seconds
				}),
				"wakeup":	enyo.application.prefs.wakingEnabled,
				"uri":		"palm://com.palm.applicationManager/open",
				"params": {
					"id":	"com.tegi-stuff.app.feedreader",
					"params": {
						"action": "feedUpdate"
					}
				}
			}, {
				method:		"set"
			});
        } else {
			this.$.setAlarm.call({
				"key": this.key
			}, {
				method:		"clear"
			});
		}	
	},
	
	setTimerSuccess: function() {
		this.log("TIMER> successfully set");
	},
	
	setTimerFailed: function() {
		this.error("TIMER> setting timer failed!");
	}
});