/*
 *		app/models/spooler.js - activity spooler
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

var spooler = new Class.create({
	list: [],
	actionRunning: false,
	actionIdent: "",
	
	initialize: function() {
		this.setActivitySuccessHandler = this.setActivitySuccess.bind(this);
		this.setActivityFailedHandler = this.setActivityFailed.bind(this);
		this.leaveActivitySuccessHandler = this.leaveActivitySuccess.bind(this);
		this.leaveActivityFailedHandler = this.leaveActivityFailed.bind(this);
	},
	
	addAction: function(action, identifier, unique) {
		try {
			if(!identifier) {
				identifier = "anon-action";
			}
			
			if(unique) {
				var skip = false;
				if(this.actionIdent == identifier) {
					skip = true;
				} else {
					for(var i = 0; i < this.list.length; i++) {
						if(this.list[i].ident == identifier) {
							skip = true;
							break;
						}
					}
				}
				
				if(skip) {
					return;
				}
			}
			
			this.list.push({
				execute: action,
				ident: identifier
			});
			
			if((this.list.length == 1) && !this.actionRunning)  {
				this.nextAction();
			}
		} catch(e) {
			Mojo.Log.logException(e);
		}
	},
	
	/** @private
	 *
	 * Tell the system, that we enter a phase of activity.
	 */
	enterActivity: function(duration) {
		if(duration === undefined) {
			duration = 15000;
		}
		var request = new Mojo.Service.Request("palm://com.palm.power/com/palm/power", {
			method: "activityStart",
			parameters: {
				id: "com.tegi-stuff.app.feedreader",
				duration_ms: duration
			},
			onSuccess: this.setActivitySuccessHandler,
			onFailure: this.setActivityFailedHandler
		});
	},
	
	/** @private
	 *
	 * Gets called when setting the activity was successful.
	 */
	setActivitySuccess: function(response) {
		Mojo.Log.info("SPOOLER> Successfully set activity");
	},
	
	/** @private
	 *
	 * Gets called when setting the acitivity failed.
	 */
	setActivityFailed: function(response) {
		Mojo.Log.error("SPOOLER> Unable to set activity", response);
	},

	/** @private
	 *
	 * Tell the system, that we left our activity phase.
	 */
	leaveActivity: function() {
		var request = new Mojo.Service.Request("palm://com.palm.power/com/palm/power", {
			method: "activityEnd",
			parameters: {
				id: "com.tegi-stuff.app.feedreader"
			},
			onSuccess: this.leaveActivitySuccessHandler,
			onFailure: this.leaveActivityFailedHandler
		});
	},

	/** @private
	 *
	 * Gets called when setting the activity was successful.
	 */
	leaveActivitySuccess: function(response) {
		Mojo.Log.info("SPOOLER> Successfully left activity");
	},
	
	/** @private
	 *
	 * Gets called when setting the acitivity failed.
	 */
	leaveActivityFailed: function(response) {
		Mojo.Log.error("SPOOLER> Unable to leave activity", response);
	},
	
	nextAction: function() {
		try {
			if(this.list.length >= 1) {
				var action = this.list.shift();
				this.actionRunning = true;
				this.actionIdent = action.ident;
				this.enterActivity();
				action.execute();
			} else {
				this.actionRunning = false;
				this.actionIdent = "";
				this.leaveActivity();
			}
		} catch(e) {
			Mojo.Log.logException(e);
		}
	}
});