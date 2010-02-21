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
					Mojo.Log.info("SPOOLER> Skipped adding unique action", identifier);
					return;
				}
			}
			
			this.list.push({
				execute: action,
				ident: identifier
			});
			
			if((this.list.length == 1) && !this.actionRunning)  {
				Mojo.Log.info("SPOOLER> queue was empty, direct start");
				this.nextAction();
			}
		} catch(e) {
			Mojo.Log.error("SPOOLER> error while adding action:", e);
		}
	},
	
	nextAction: function() {
		try {
			if(this.list.length >= 1) {
				var action = this.list.shift();
				this.actionRunning = true;
				this.actionIdent = action.ident;
				Mojo.Log.info("SPOOLER> processing next action", this.actionIdent);
				action.execute();
			} else {
				this.actionRunning = false;
				this.actionIdent = "";
				Mojo.Log.info("SPOOLER> All spooled actions have been executed");
			}
		} catch(e) {
			Mojo.Log.error("SPOOLER> Exception while processing:", e);
		}
	}
});