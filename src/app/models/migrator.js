/*
 *		app/models/migrator.js - Database migration functions
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

var migrator = Class.create ({
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
			data[i].uid = Math.uuid(15);
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
