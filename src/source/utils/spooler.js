/*
 *		source/utils/spooler.js - activity spooler
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

	name:			"Spooler",
	kind:			"Component",

	components:	[{
		name:		"powerService",
		kind:		"PalmService",
		service:	"palm://com.palm.power/com/palm/power/",
		subscribe:	true
	}],

	list: 			[],
	actionRunning:	false,
	actionIdent:	"",
	updateCounter:	0,
	key:			"com.tegi-stuff.app.feedreader",

	/**
	 * Enter update state. This will prevent the spooler from starting an
	 * activity until the update state is left.
	 */
	beginUpdate: function() {
		this.updateCounter++;
	},

	/**
	 * Leave update state. If actions were added while being in update state
	 * the spooler will start the first action from the list.
	 */
	endUpdate: function() {
		this.updateCounter--;
		if(!this.actionRunning && (this.list.length >= 1)) {
//			Mojo.Controller.getAppController().sendToNotificationChain({ type: "updatestate-changed" });
			this.nextAction();
		}
	},

	/**
	 * Add an action to the spooler list.
	 *
	 * @param	action		{Function}		function to execute
	 * @param	identifier	{String}		name of the action
	 * @param	unique		{Boolean}		if true, only one action with the
	 * 										given name is allowed to be executed
	 * 										at any time
	 */
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

			if((this.updateCounter === 0) && (this.list.length == 1) && !this.actionRunning)  {
//				DashboardControl.createUpdateDashboard();
				this.nextAction();
			}
		} catch(e) {
			this.error(e);
		}
	},

	/** @private
	 *
	 * Tell the system, that we enter a phase of activity.
	 */
	enterActivity: function(duration) {
		if(duration === undefined) {
			duration = 60000;
		}

		this.$.powerService.call({
			id:				this.key,
			duration_ms: 	duration
		}, {
			method:		"activityStart",
			onSuccess:	"setActivitySuccess",
			onFailure:	"setActivityFailed"
		});
	},

	/** @private
	 *
	 * Gets called when setting the activity was successful.
	 */
	setActivitySuccess: function(response) {
		this.log("SPOOLER> Successfully set activity");
	},

	/** @private
	 *
	 * Gets called when setting the acitivity failed.
	 */
	setActivityFailed: function(response) {
		this.error("SPOOLER> Unable to set activity", response);
	},

	/** @private
	 *
	 * Tell the system, that we left our activity phase.
	 */
	leaveActivity: function() {
		this.$.powerService.call({
			id:			this.key
		}, {
			method: 	"activityEnd",
			onSuccess: 	"leaveActivitySuccess",
			onFailure: 	"leaveActivityFailed"
		});
	},

	/** @private
	 *
	 * Gets called when setting the activity was successful.
	 */
	leaveActivitySuccess: function(response) {
		this.log("SPOOLER> Successfully left activity");
	},

	/** @private
	 *
	 * Gets called when setting the acitivity failed.
	 */
	leaveActivityFailed: function(response) {
		this.error("SPOOLER> Unable to leave activity", response);
	},

	/**
	 * Called to indicate a spooled action has finished. The next spooled
	 * activity will be started if any.
	 */
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
//				DashboardControl.removeUpdateDashboard();
				enyo.application.feeds.interactiveUpdate = false;
//				Mojo.Controller.getAppController().sendToNotificationChain({ type: "updatestate-changed" });
				this.leaveActivity();
			}
		} catch(e) {
			this.error(e);
		}
	},

	hasWork: function() {
		return ((this.list.length > 0) ||
				(this.actionRunning) ||
				(this.updateCounter > 0));
	},

	/**
	 * Called to indicate that the app is about to be closed.
	 */
	aboutToClose: function() {
		try {
/*			if(this.hasWork()) {
				DashboardControl.createUpdateDashboard(true);
			}*/
		} catch(e) {
			this.error(e);
		}
	}
});
