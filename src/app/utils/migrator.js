/*
 *		app/utils/migrator.js - Database migration functions
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

var migrator = Class.create ({
	db:			null,
	depot:		null,
	ver:		0,
	finished:	false,
	
	initialize: function(db, ver) {
		this.db = db;
		this.ver = ver;
		
		this.depot = new Mojo.Depot({
			name: "FeedListDB",
			version: 1,
			estimatedSize: 500000,
			replace: false
		}, this.openDepotSuccess.bind(this), function(transaction, result) {
			Mojo.Log.warn("MIGRATOR> Can't open feed depot: ", result.message);
		});
	},
	
	openDepotSuccess: function() {
			this.depot.get("feedList",
			this.loadFeedListSuccess.bind(this),
			this.loadFeedListFailed.bind(this));
	},
	
	/** @private
	 * 
	 * Called when the feed list object could be found in the depot.
	 * 
	 * @param {Object} data
	 */
	loadFeedListSuccess: function(data) {
        if (data !== null && Object.toJSON(data) != "{}") { 
            this.list = this.migrate(data, this.ver);
			Mojo.Log.info("MIGRATOR> Got old feed depot, version", this.ver);
			
			// 'list' now contains the old feed list object in the latest format.
			// Now we need to push it into the new database.
			var s = 0;
			var feed = null;
			var stories = null;
			var story = {};
			for(var f = 0; f < this.list.length; f++) {
				if(this.list[f].type == "allItems") {
					continue;
				}
				
				this.list[f].viewMode = parseInt(this.list[f].viewMode, 10);
				var fullStory = this.list[f].viewMode & 0xFF;
				var detailViewMode = this.list[f].viewMode >> 24;
				var listViewMode = this.list[f].viewMode >> 16;
				feed = {
					title:				this.list[f].title,
					url:				this.list[f].url,
					feedOrder:			f + 1,
					enabled:			this.list[f].enabled,
					showPicture:		this.list[f].showPicture,
					showMedia:			this.list[f].showMedia,
					showListSummary:	((listViewMode === 0) || (listViewMode == 2)) ? 1 : 0,
					showDetailSummary:	((detailViewMode === 0) || (detailViewMode == 2)) ? 1 : 0,
					showListCaption:	(listViewMode < 2) ? 1 : 0,
					showDetailCaption:	(detailViewMode < 2) ? 1 : 0,
					sortMode:			this.list[f].sortMode,
					allowHTML:			this.list[f].allowHTML,
					fullStory:			fullStory,
					username:			"",
					password:			""
				};
				switch(this.list[f].type) {
					case "RDF":
						feed.feedType = feedTypes.ftRDF;
						break;
					
					case "rss":
						feed.feedType = feedTypes.ftRSS;
						break;
					
					case "ATOM":
						feed.feedType = feedTypes.ftATOM;
						break;
					
					default:
						feed.feedType = feedTypes.ftUnknown;
						break;
				}
				
				Mojo.Log.info("MIGRATOR> converting feed", feed.title);
				this.db.addOrEditFeed(feed);
			}
		}
		delete this.list;
		this.depot.removeAll();	// Delete the depot database.
		Mojo.Log.info("MIGRATOR> migration complete");
		
		this.finished = true;
	},
	
	/** @private
	 *
	 * Called when the feed list cannot be retrieved.
	 */
	loadFeedListFailed: function() {
		Mojo.Log.warn("MIGRATOR> unable to retrieve feedlist");
		Mojo.Controller.getAppController().sendToNotificationChain({ type: "feedlist-loaded" });
	},
	
	/** @private
	 *
	 * Migrate a v1 database to v2 format.
	 *
	 */
	migrateV1: function(data) {
		var j;
		var newdata = [];
		
		for(var i = 0; i < data.length; i++) {
			// Skip invalid feeds.
			if((data[i].type != "rss") &&
			   (data[i].type != "RDF") &&
			   (data[i].type != "atom")) {
				continue;	
			}
			
			// Update all feeds to new format.
			// New properties:	viewMode		Show feeds in FeedReader or in Browser
			//					sortMode		How the feed should be sorted
			//					spinning		Wether the feed's spinner is spinning
			//					preventDelete	Prevent deletion (to avoid delete pseudo feeds)
			newdata.push({
				type: 			data[i].type,
				url: 			data[i].url,
				title: 			data[i].title,
				enabled: 		data[i].enabled,
				numUnRead: 		data[i].numUnRead,
				numNew: 		data[i].numNew,
				viewMode: 		0,
				sortMode:		0,
				updated: 		true,
				spinning: 		false,
				preventDelete: 	false,
				stories: 		[]
			});
			
			// Update stories.
			// New properties:	intDate			Takes the date as an integer, will be used
			//									for sorting purposes in future.
			// Changed:			summary			Will contain the full story from now on.
			//									This cannot be reconstructed.
			for(j = 0; j < data[i].stories.length; j++) {
				newdata[newdata.length - 1].stories.push({
					title: 		data[i].stories[j].title,
					summary:	data[i].stories[j].summary,
					url: 		data[i].stories[j].url,
					intDate:	0,
					uid: 		data[i].stories[j].uid,
					isRead: 	data[i].stories[j].isRead,
					isNew: 		data[i].stories[j].isNew
				});
			}
		}
		
		// Add the new "All Items" pseudo feed.
		newdata.unshift({
			type: 			"allItems",
			url: 			"",
			title: 			"",
			enabled: 		true,
			numUnRead: 		0,
			numNew: 		0,
			viewMode: 		0,
			updated: 		true,
			spinning: 		false,
			preventDelete: 	true,
			stories: 		[]
		});
		
		return newdata;
	},
	
	/** @private
	 *
	 * Migrate a v2 database to a v3 database.
	 */
	migrateV2: function(data) {
		var j;
		
		for(var i = 0; i < data.length; i++) {
			data[i].showPicture = true;
			data[i].showMedia = true;
			for(j = 0; j < data[i].stories.length; j++) {
				data[i].stories[j].picture = "";
				data[i].stories[j].audio = "";
				data[i].stories[j].video = "";
			}
		}
		
		return data;
	},
	
	/** @private
	 *
	 * Migrate a v3 database to a v4 database.
	 */
	migrateV3: function(data) {
		var j;
		
		for(var i = 0; i < data.length; i++) {
			// The sortMode was introduced in DBv2, but addFeed failed to
			// add this to new feeds, so re-introduce it here.
			data[i].sortMode = 0;
			for(j = 0; j < data[i].stories.length; j++) {
				data[i].stories[j].index = 0;
			}
		}
		
		return data;		
	},
	
	/** @private
	 *
	 * Migrate a v5 database to a v6 database.
	 */
	migrateV5: function(data) {
		var j = 0;
		var oldURL = "";
		for(var i = 0; i < data.length; i++) {
			if(data[i].type == "allItems") {
				continue;
			}
			
			data[i].allowHTML = 1;
			for(j = 0; j < data[i].stories.length; j++) {
				oldURL = data[i].stories[j].url;
				data[i].stories[j].url = [];
				data[i].stories[j].url.push({
					title:	"Weblink",
					href:	oldURL
				});
			}
		}
		
		return data;		
	},
	
	migrate: function(data, version) {
		if(version < 2) {
			data = this.migrateV1(data);
		}
		if(version < 3) {
			data = this.migrateV2(data);
		}
		if(version < 4) {
			data = this.migrateV3(data);
		}
		if(version < 6) {
			data = this.migrateV5(data);
		}
		
		return data;
	}
});
