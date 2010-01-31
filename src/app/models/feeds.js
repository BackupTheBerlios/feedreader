/*
 *		app/models/feeds.js - Feed data model
 */

/* FeedReader - A RSS Feed Aggregator for Palm WebOS
 * Copyright (C) 2009, 2010 Timo Tegtmeier
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
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

var feeds = Class.create ({
	db: {},
	list: [],
	fullUpdateInProgress: false,
	updateInProgress: false,
	interactiveUpdate: false,
	modified: false,
	activityLevel: 0,
	activity: {},
	connStatus: {},
	cookie: {},
	properties: {
		migratingFrom: 1
	},

	/** @private
	 *
	 * Initializing.
	 */	
	initialize: function() {
		this.cookie = new Mojo.Model.Cookie("comtegi-stuffAppFeedReaderProps");
		
		var data = this.cookie.get();
		if(data) {
			this.properties.migratingFrom = data.version;
		} else {
			this.properties.migratingFrom = 1;
		}
		
		// Pre-bind some things to speed up repetitive usage.
		this.setActivitySuccessHandler = this.setActivitySuccess.bind(this);
		this.setActivityFailedHandler  = this.setActivityFailed.bind(this);
		
		this.openDBSuccessHandler = this.openDBSuccess.bind(this);
		this.openDBFailedHandler  = this.openDBFailed.bind(this);
		
		this.loadFeedListSuccessHandler = this.loadFeedListSuccess.bind(this);
		this.loadFeedListFailedHandler  = this.loadFeedListFailed.bind(this);
		
		this.saveFeedListSuccessHandler = this.saveFeedListSuccess.bind(this);
		this.saveFeedListFailedHandler  = this.saveFeedListFailed.bind(this);
	},
	
	/**
	 * Load the feed list from a Depot.
	 */
	load: function() {
		this.db = new Mojo.Depot({
			name: "FeedListDB",
			version: 1,
			estimatedSize: 500000,
			replace: false
		}, this.openDBSuccessHandler, this.openDBFailedHandler);
	},
	
	/** @private
	 * 
	 * Called when opening the depot succeeds.
	 */
	openDBSuccess: function() {
        this.db.get("feedList",
					this.loadFeedListSuccessHandler,
					this.loadFeedListFailedHandler);
	},
	
	/** @private
	 *
	 * Called when opening the depot fails.
	 */
	openDBFailed: function(transaction, result) {
		Mojo.Log.warn("Can't open feed database: ", result.message);
	},

	/** @private
	 * 
	 * Called when the feed list object could be found in the depot.
	 * 
	 * @param {Object} data
	 */
	loadFeedListSuccess: function(data) {
        Mojo.Log.info("Database size: " , Object.values(data).size());
	    
        if (Object.toJSON(data) == "{}" || data === null) { 
			this.list = [ {
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
				stories: 		[] } ];
        } else {		
			if(this.properties.migratingFrom < 2) {
				data = this.migrateV1(data);
			}
            this.list = data;
		}
			
		this.cookie.put({ version: FeedReader.versionInt });
		Mojo.Controller.getAppController().sendToNotificationChain({ type: "feedlist-loaded" });
        this.update();
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
			//					spnning			Wether the feed's spinner is spinning
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
					date: 		data[i].stories[j].date,
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
		
		this.modified = true;
		return newdata;
	},
	
	/** @private
	 *
	 * Called when the feed list cannot be retrieved.
	 */
	loadFeedListFailed: function() {
		Mojo.Log.warn("unable to retrieve feedlist");
	},

	/**
	 * Save the feed list to a depot.
	 */
	save: function() {
		if(this.modified) {
			this.db.add("feedList", this.list,
						this.saveFeedListSuccessHandler,
						this.saveFeedListFailedHandler);
		} else {
			Mojo.Log.info("list not changed; no saving needed");
		}
	},
	
	/** @private
	 *
	 * Called when saving the feed list succeeds.
	 */
	saveFeedListSuccess: function() {
		this.modified = false;
		Mojo.Log.info("feed list saved");
	},
	
	/** @private
	 *
	 * Called when saving the feed list fails.
	 */
	saveFeedListFailed: function(transaction, result) {
		Mojo.Log.warn("feed list could not be saved: ", result.message);
	},
	
	/**
	 * Add a new feed.
	 * 
	 * @param {String} title
	 * @param {String} url
	 * @param {Boolean} enabled
	 * @param {Int} viewMode
	 */
	addFeed: function(title, url, enabled, viewMode) {
		this.interactiveUpdate = true;
		if (title === "") {
			title = "News Feed";
		}
			
		for(var i; i < this.list.length; i++) {
			if (this.list[i].url == url) {
				this.editFeed(i, title, url, enabled, viewmode);
				return;
			} 
		}
			
		this.list.push({
			title: title,
			url: url,
			type: "rss",
			numUnRead: 0,
			numNew: 0,
			enabled: enabled,
			viewMode: viewMode,
			preventDelete: false,
			updated: true,
			spinning: false,
			stories: []
		});
		this.modified = true;
		Mojo.Controller.getAppController().sendToNotificationChain({ type: "feedlist-newfeed" });
		this.interactiveUpdate = true;
		this.updateFeed(this.list.length - 1);
	},
	
	/**
	 * Update the properties of a feed.
	 * 
	 * @param {int} index
	 * @param {String} title
	 * @param {String} url
	 * @param {Boolean} enabled
	 * @param {Int} viewMode
	 */
	editFeed: function(index, title, url, enabled, viewMode) {
		if((index >= 0) && (index < this.list.length)) {
			this.interactiveUpdate = true;
			this.list[index].title = title;
			this.list[index].url = url;
			this.list[index].enabled = enabled;
			this.list[index].viewMode = viewMode;
			this.modified = true;
			Mojo.Controller.getAppController().sendToNotificationChain({
				type: "feedlist-editedfeed",
				feedIndex: index
			});
			this.updateFeed(index);
		}
	},
	
	/** @private
	 *
	 * Tell the system, that we enter a phase of activity.
	 */
	enterActivity: function(index) {
		this.activityLevel++;
		if(this.activityLevel == 1) {
			var count;
			if(index !== undefined) {
				count = 15000;
			} else {
				count = this.list.length * 15000;
			}
			this.activity = new Mojo.Service.Request("palm://com.palm.power/com/palm/power", {
				method: "activityStart",
				parameters: {
					id: "com.tegi-stuff.app.feedreader",
					duration_ms: count
				},
				onSuccess: this.setActivitySuccessHandler,
				onFailure: this.setActivityFailedHandler
			});
		}
	},
	
	/** @private
	 *
	 * Tell the system, that we left our activity phase.
	 */
	leaveActivity: function() {
		this.activityLevel--;
		if(this.activityLevel <= 0) {
			this.activityLevel = 0;
			this.activity = new Mojo.Service.Request("palm://com.palm.power/com/palm/power", {
				method: "activityEnd",
				parameters: {
					id: "com.tegi-stuff.app.feedreader"
				},
				onSuccess: this.setActivitySuccessHandler,
				onFailure: this.setActivityFailedHandler
			});
		}
	},

	/** @private
	 *
	 */
	setActivitySuccess: function(response) {
		Mojo.Log.info("Successfully set activity");
	},
	
	/** @private
	 *
	 */
	setActivityFailed: function(response) {
		Mojo.Log.warn("Unable to set activity", response);
	},
	
	/** @private
	 * 
	 * Send a notification about a feeds update state. 
	 * 
	 * @param {int} index			feed index
	 * @param {Boolean} updating	update state
	 */
	notifyOfFeedUpdate: function(index, updating) {
		this.list[index].spinning = updating;
		Mojo.Controller.getAppController().sendToNotificationChain({
			type: "feed-update",
			inProgress: updating,
			feedIndex: index
		});		
	},
	
	/**
	 * Updates a feed.
	 * 
	 * @param {int} index		index of the feed to update.
	 */
	updateFeed: function(index) {
		// Tell the current scene that we're about to update a feed.
		if ((index >= 0) && (index < this.list.length)) {
			if(this.list[index].type == "allItems") {
				return;
			}
			
			this.connStatus = new Mojo.Service.Request('palm://com.palm.connectionmanager', {
				method: 'getstatus',
				parameters: {},
				onSuccess: this.getConnStatusSuccess.bind(this, index),
				onFailure: this.getConnStatusFailed.bind(this, index)
			});
		}		
	},

	/** @private
	 * 
	 * Called when the connection status could be retrieved.
	 *
	 * @param {int} index		Feed Index to be updated
	 * @param {Object} result	Information about the connection status
	 */	
	getConnStatusSuccess: function(index, result) {
		if(result.isInternetConnectionAvailable) {
			this.enterActivity(index);
			this.updateInProgress = true;
			if(!this.list[index].enabled) {
				this.list[index].updated = true;
				Mojo.Log.info("Feed", index, "will not be updated due being disabled");
				return;
			}
			this.list[index].updated  = false;			
			this.notifyOfFeedUpdate(index, true);
			var request = new Ajax.Request(this.list[index].url, {
	    	        method: "get",
					evalJS: "false",
	        	    evalJSON: "false",
	            	onSuccess: this.updateFeedSuccess.bind(this, index),
	            	onFailure: this.updateFeedFailed.bind(this, index)});
		} else {
			Mojo.Log.info("No internet connection available");
		}
	},
	
	/** @private
	 * 
	 * Called when the connection status could not be retrieved.
	 *
	 * @param {int} index		Feed Index to be updated
	 * @param {Object} result	Information about the connection status
	 */	
	getConnStatusFailed: function(index, result) {
		Mojo.Log.warn("Unable to determine connection status");
	},
	
	/** @private
	 * 
	 * Reformat a story's summary.
	 * 
	 * @param {String} summary		string containing the summary to reformat
	 * @return {String}				reformatted summary
	 */
	reformatSummary: function(summary) {
        summary = summary.replace(/(<([^>]+)>)/ig, "");
        summary = summary.replace(/http:\S+/ig, "");
        summary = summary.replace(/#[a-z]+/ig, "{");
        summary = summary.replace(/(\{([^\}]+)\})/ig, "");
        summary = summary.replace(/digg_url .../, "");
        summary = unescape(summary);
		return summary;	
	},
	
	/** @private
	 * 
	 * Reformat a date to system locale, supports dc:date and RFC 822 format.
	 * 
	 * @param {Object}		story
	 * @param {String}		date string to reformat
	 */
	reformatDate: function(story, dateString) {
		var d;
		var parts;
		
		try {
			if (dateString.match(/\D{3},\s\d{1,2}\s\D{3}\s\d{2,4}\s\d{1,2}:\d{1,2}:\d*/)) {
				// RFC 822 date
				d = new Date(dateString);
			} else if (dateString.match(/\D{3}\s\D{3}\s\d{2}\s\d{2}:\d{2}:\d{2}\s[a-zA-Z\+\-0-9]{1,5}\s\d{3}/)) {
				// Sat Jan 09 17:36:47 CET 2010
				d = new Date();
				parts = dateString.split(" ");
				
				switch(parts[1]) {
					case "Jan":	d.setMonth(0); break;
					case "Feb": d.setMonth(1); break;
					case "Mar": d.setMonth(2); break;
					case "Apr": d.setMonth(3); break;
					case "May": d.setMonth(4); break;
					case "Jun": d.setMonth(5); break;
					case "Jul": d.setMonth(6); break;
					case "Aug": d.setMonth(7); break;
					case "Sep": d.setMonth(8); break;
					case "Oct": d.setMonth(9); break;
					case "Nov": d.setMonth(10); break;
					case "Dec": d.setMonth(11); break;
				}
				d.setDate(parseInt(parts[2], 10));
				d.setYear(parseInt(parts[5], 10));
				
				parts = parts[3].split(":");
				d.setHours(parts[0]);
				d.setMinutes(parts[1]);
				d.setSeconds(parts[2]);
			} else {
				d = new Date();
				
				// Dublin core date. See: http://www.w3.org/TR/NOTE-datetime
				parts = dateString.split("T");
				if(parts[0]) {
					var dateComponents = parts[0].split("-");
					if(dateComponents[0]) {
						d.setFullYear(parseInt(dateComponents[0], 10));
					}
					if(dateComponents[1]) {
						d.setMonth(parseInt(dateComponents[1], 10) - 1);
					}
					if(dateComponents[2]) {
						d.setDate(parseInt(dateComponents[2], 10));
					}
				}
				if(parts[1]) {
					if (parts[1].match(/.*\-.*/)) {
						parts = parts[1].split('-');
					} else if (parts[1].match(/.*\+.*/)) {
						parts = parts[1].split('+');
					} else if (parts[1].match(/.*\D{1}/)) {
						parts[0] = parts[1].substring(0, parts[1].length - 2);
						parts[1] = parts[1].substring(parts[1].length - 1, 1);
					}
					if(parts[0]) {
						var timeComponents = parts[0].split(":");
						if(timeComponents[0]) {
							d.setHours(parseInt(timeComponents[0], 10));
						}
						if(timeComponents[1]) {
							d.setMinutes(parseInt(timeComponents[1], 10));
						}
						if(timeComponents[2]) {
							d.setSeconds(parseInt(timeComponents[2], 10));
						}
					}
					// TODO: respect the time zone.
				}
			}
		} catch(e) {
			Mojo.Log.error("Exception during date processing:", e);
		}
		
		story.date = Mojo.Format.formatDate(d, "medium");
		story.intDate = d.getTime();
	},
	
	/** @private
	 * 
	 * Determine the type of the given feed.
	 * 
	 * @param {int} index			feed index
	 * @param {Object} transport	Ajax transport
	 * @return {Boolean}			true if type is supported
	 */
	determineFeedType: function(index, transport) {
		var feedType = transport.responseXML.getElementsByTagName("rss");
		var errorMsg = {};
		
		if(transport.responseText.length === 0) {
			if (this.interactiveUpdate) {
				errorMsg = new Template($L("The Feed '#{title}' does not return data."));
				FeedReader.showError(errorMsg, { title: this.list[index].url });
			}
			ojo.Log.warn("Empty responseText in", this.list[index].url);
			this.list[index].type = "unknown";
			return false;			
		}

		if (feedType.length > 0) {
			this.list[index].type = "rss";				// RSS 2 
		} else {    
			feedType = transport.responseXML.getElementsByTagName("RDF");
			if (feedType.length > 0) {
				this.list[index].type = "RDF";			// RSS 1
			} else {
				feedType = transport.responseXML.getElementsByTagName("feed");
				if (feedType.length > 0) {
					this.list[index].type = "atom";		// ATOM
				} else {
					if (this.interactiveUpdate) {
						errorMsg = new Template($L("The format of Feed '#{title}' is unsupported."));
						FeedReader.showError(errorMsg, {title: this.list[index].url});
					}
					Mojo.Log.warn("Unsupported feed format in", this.list[index].url);
					this.list[index].type = "unknown";
					return false;
				}
			}
		}
		return true;
	},
	
	/** @private
	 *
	 * Parse RDF Feed data.
	 *
	 * @param {Object} transport
	 * @returns {Array} story container
	 */
	parseAtom: function(index, transport) {
		var container = [];
		var atomItems = transport.responseXML.getElementsByTagName("entry");
		for (var i = 0; i < atomItems.length; i++) {
			try {
				story = {
					title: unescape(atomItems[i].getElementsByTagName("title").item(0).textContent),
					summary: "",
					url: atomItems[i].getElementsByTagName("link").item(0).getAttribute("href"),
					date: "",
					intDate: 0,
					uid: "",
					isRead: false,
					isNew: true
				};
				
				// Set the summary. Normally this will be pulled out of the summary element,
				// but sometimes this element does not exist.
				if (atomItems[i].getElementsByTagName("summary") && atomItems[i].getElementsByTagName("summary").item(0)) {
					story.summary = this.reformatSummary(atomItems[i].getElementsByTagName("summary").item(0).textContent);
				}
				else 
					if (atomItems[i].getElementsByTagName("content") && atomItems[i].getElementsByTagName("content").item(0)) {
						story.summary = this.reformatSummary(atomItems[i].getElementsByTagName("content").item(0).textContent);
					}
					else {
						story.summary = story.title;
					}
				
				// Set the publishing date.
				if (atomItems[i].getElementsByTagName("updated") && atomItems[i].getElementsByTagName("updated").item(0)) {
					this.reformatDate(story, atomItems[i].getElementsByTagName("updated").item(0).textContent);
				}
				
				// Set the unique id.
				if (atomItems[i].getElementsByTagName("id") && atomItems[i].getElementsByTagName("id").item(0)) {
					story.uid = atomItems[i].getElementsByTagName("id").item(0).textContent;
				}
				else {
					story.uid = story.url;
				}
				
				container.push(story);
			} catch(e) {
			}
		}
		return container;
	},
	
	/** @private
	 *
	 * Parse RSS Feed data.
	 *
	 * @param {Object} transport
	 * @returns {Array} story container
	 */
	parseRSS: function(index, transport) {
		var container = [];
		var rssItems = transport.responseXML.getElementsByTagName("item");
		if(!rssItems) {
			Mojo.Log.info("Feed", index, "is empty");
			return container;
		}
		
		for (var i = 0; i < rssItems.length; i++) {
			try {
				story = {
					title: unescape(rssItems[i].getElementsByTagName("title").item(0).textContent),
					summary: this.reformatSummary(rssItems[i].getElementsByTagName("description").item(0).textContent),
					url: rssItems[i].getElementsByTagName("link").item(0).textContent,
					date: "",
					intDate: 0,
					uid: "",
					isRead: false,
					isNew: true,
					originIndex: {
						feedIndex: index,
						storyIndex: i
					}
				};
				
				// Set the publishing date.
				if (rssItems[i].getElementsByTagName("pubDate") && rssItems[i].getElementsByTagName("pubDate").item(0)) {
					this.reformatDate(story, rssItems[i].getElementsByTagName("pubDate").item(0).textContent);
				} else if (rssItems[i].getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "date") &&
						   rssItems[i].getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "date").item(0)) {
					this.reformatDate(story, rssItems[i].getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "date").item(0).textContent);
				}
				
				// Set the unique id.
				if (rssItems[i].getElementsByTagName("guid") && rssItems[i].getElementsByTagName("guid").item(0)) {
					story.uid = rssItems[i].getElementsByTagName("guid").item(0).textContent;
				}
				else {
					story.uid = story.url;
				}
				
				container.push(story);
			} catch(e) {
				Mojo.Log.warn("Exception occurred during feed item processing", i);
			}
		}
		return container;
	},
	
	/** @private
	 *
	 * Parse RDF Feed data.
	 *
	 * @param {Object} transport
	 * @returns {Array} story container
	 */
	parseRDF: function(index, transport) {
		// Currently we do the same as for RSS.
		return this.parseRSS(index, transport);
	},
	
	/** @private
	 *
	 * !! HACK WARNING !!
	 * This should not be needed theoretically. But prototype or maybe even
	 * WebOS gets the encoding wrong as it displays the corresponding
	 * characters from windows-1252. This thingy does the conversion.
	 * 
	 * Coverts text from codepage 1250.
	 */
	convertWin1250: function(text) {
		if(text) {
			text = text.replace(/Œ/g, "Ś");	// 8C
			
			text = text.replace(/œ/g, "ś");	// 9C
			text = text.replace(/Ÿ/g, "ź");	// 9F
			
			text = text.replace(/¢/g, "˘");	// A2
			text = text.replace(/£/g, "Ł"); // A3
			text = text.replace(/¥/g, "Ą");	// A5
			text = text.replace(/ª/g, "Ş");	// AA
			
			text = text.replace(/³/g, "ł");	// B3
			text = text.replace(/¹/g, "ą");	// B9
			text = text.replace(/º/g, "ş");	// BA
			text = text.replace(/¼/g, "Ľ");	// BC
			text = text.replace(/½/g, "˝"); // BD
			text = text.replace(/¾/g, "ľ");	// BE
			text = text.replace(/¿/g, "ż");	// BF
			
			text = text.replace(/À/g, "Ŕ");	// C0
			text = text.replace(/Ã/g, "Ă");	// C3
			text = text.replace(/Å/g, "Ĺ");	// C5
			text = text.replace(/Æ/g, "Ć");	// C6
			text = text.replace(/È/g, "Č");	// C8
			text = text.replace(/Ê/g, "Ę");	// CA
			text = text.replace(/Ì/g, "Ě");	// CC
			text = text.replace(/Ï/g, "Ď");	// CF
			
			text = text.replace(/Ñ/g, "Ń");	// D1
			text = text.replace(/Ò/g, "Ň");	// D2
			text = text.replace(/Õ/g, "Ő");	// D5
			text = text.replace(/Ø/g, "Ř");	// D8
			text = text.replace(/Ù/g, "Ů");	// D9
			text = text.replace(/Û/g, "Ű");	// DB
			text = text.replace(/Þ/g, "Ţ");	// DE
			
			text = text.replace(/à/g, "ŕ");	// E0
			text = text.replace(/ã/g, "ă");	// E3
			text = text.replace(/å/g, "ĺ");	// E5
			text = text.replace(/æ/g, "ć");	// E6
			text = text.replace(/è/g, "č");	// E8
			text = text.replace(/ê/g, "ę");	// EA
			text = text.replace(/ì/g, "ě");	// EC
			text = text.replace(/ï/g, "ď");	// EF
			
			text = text.replace(/ð/g, "đ");	// F0
			text = text.replace(/ñ/g, "ń");	// F1
			text = text.replace(/ò/g, "ň");	// F2
			text = text.replace(/õ/g, "ő");	// F5
			text = text.replace(/ø/g, "ř");	// F8
			text = text.replace(/ù/g, "ů");	// F9
			text = text.replace(/û/g, "ű");	// FB
			text = text.replace(/þ/g, "ţ");	// FE
			text = text.replace(/ÿ/g, "˙");	// FF
			
			return text;
		} else {
			return "";
		}
	},
	
	/** @private
	 * 
	 * Called when an Ajax request succeeds.
	 * 
	 * @param {int} index
	 * @param {Object} transport
	 */
	updateFeedSuccess: function(index, transport) {
		try {
			if((transport.responseXML === null) && (transport.responseText !== null)) {
				Mojo.Log.info("Manually converting feed info to xml", transport.responseText);
				transport.responseXML = new DOMParser().parseFromString(transport.responseText, "text/xml");
			}
			
			var converter = undefined;
			if(transport.getHeader("Content-Type")) {
				if(transport.getHeader("Content-Type").match(/.*windows\-1250.*/) ||
				   transport.getHeader("Content-Type").match(/.*win\-1250.*/)) {
					converter = this.convertWin1250;
				}
			}
			
			if(this.determineFeedType(index, transport)) {
				Mojo.Log.info("Feed", index, "is of type", this.list[index].type);
				var newStories = [];
				
				switch(this.list[index].type) {
					case "RDF":
						newStories = this.parseRDF(index, transport);
						break;
						
					case "rss":
						newStories = this.parseRSS(index, transport);
						break;
						
					case "atom":
						newStories = this.parseAtom(index, transport);
						break;
				}
				
				Mojo.Log.info("Feed", index, "retrieved;", newStories.length, "stories");
				var isNew;										
				this.list[index].numUnRead = newStories.length;
				this.list[index].numNew = 0;
				
				for (var i = 0; i < newStories.length; i++) {
					for (var j = 0; j < this.list[index].stories.length; j++) {
						if(converter) {
							newStories[i].title = converter(newStories[i].title);
							newStories[i].summary = converter(newStories[i].summary);
						}
						if(newStories[i].uid == this.list[index].stories[j].uid) {
							newStories[i].isRead = this.list[index].stories[j].isRead;
							newStories[i].isNew = this.list[index].stories[j].isNew;
							break;
						}            
					}
					
					if(newStories[i].isNew) {
						this.list[index].numNew++;
					}
					if(newStories[i].isRead) {
						this.list[index].numUnRead--;
					}
				}
				this.list[index].stories = newStories;
				
			} 
		} catch(e) {
			Mojo.Log.warn("Exception during feed processing", e);
		}
		this.finishUpdate(index);	
	},
	
	/** @private
	 * 
	 * Called when an Ajax request fails.
	 * 
	 * @param {Object} index
	 * @param {Object} transport
	 */
	updateFeedFailed: function(index, transport) {
		try {
			// TODO: handle redirections.
			var error = "";
			switch(transport.status) {
				case 400:
					error = $L("Bad Request");
					break;			
				case 401:
					error = $L("Unauthorized");
					break;
				case 403:
					error = $L("Forbidden");
					break;
				case 404:
					error = $L("Not Found");
					break;
				case 405:
					error = $L("Method Not Allowed");
					break;
				case 406:
					error = $L("Not Acceptable");
					break;
				default:
					if (transport.status >= 500) {
						error = $L("Server error");
					} else {
						error = $L("Unexpected error");
					}
					break;
			}
	
			Mojo.Log.info("Feed", index, "is defect; disabling feed; error:", error);
			if (this.interactiveUpdate) {
				var errorMsg = new Template($L("The Feed '#{title}' could not be retrieved. The server responded: #{err}. The Feed was automatically disabled."));
				FeedReader.showError(errorMsg, {title: this.list[index].url, err: error});
			}
		} catch(e) {
		}
		
		this.list[index].enabled = false;
		this.finishUpdate(index);
	},
	
	/** @private
	 *
	 * Finishes feed updates.
	 */
	finishUpdate: function(index) {
		this.list[index].updated = true;
		
		if(this.fullUpdateInProgress) {
			var updateComplete = true;
			for(var i = 0; (i < this.list.length) && updateComplete; i++) {
				updateComplete = this.list[i].updated;
			}
			
			if(updateComplete) {
				Mojo.Log.info("Full Update completed.");
				this.fullUpdateInProgress = false;
				
				// Post a banner notification if applicable.
				if((!FeedReader.isActive) && (FeedReader.prefs.notificationEnabled)) {
					var n = 0;
					for(i = 0; i < this.list.length; i++) {
						n += this.list[i].numNew;
					}
					
					if (n > 0) {
						var t = new Template($L("#{num} new stories"));
						Mojo.Controller.getAppController().showBanner({
							messageText: t.evaluate({
								num: n
							}),
							soundClass: "alerts"
						}, "bannerPressed");
					}
				}
				
				this.leaveActivity();
			}
		}
		this.modified = true;
		this.updateInProgress = this.fullUpdateInProgress;
		this.interactiveUpdate = false;
		this.notifyOfFeedUpdate(index, false);
		this.updatePseudoFeeds();
		this.leaveActivity();
	},

	/**
	 * Updates all feeds.
	 */
	update: function() {
		var i;
		
		if(this.list.length < 2) {
			return;
		}
		
		Mojo.Log.info("Full update requested");
		this.fullUpdateInProgress = true;
		this.updateInProgress = true;
		this.enterActivity();
		
		for(i = 0; i < this.list.length; i++) {
			this.updateFeed(i);
		}
	},
	
	/**
	 * Update the pseudo feeds.
	 *
	 * @param {Boolean}	disableNotification		If set, omit the notification
	 */
	updatePseudoFeeds: function(disableNotification) {
		if(this.updateInProgress) {
			return;
		}
		
		var allItemsIndex = -1;
		var numUnRead = 0, numNew = 0;
		
		for(var i = 0; i < this.list.length; i++) {
			if(this.list[i].type != "allItems") {
				numUnRead += this.list[i].numUnRead;
				numNew += this.list[i].numNew;
			} else {
				allItemsIndex = i;
			}
		}
		
		if(allItemsIndex >= 0) {
			this.list[allItemsIndex].numNew = numNew;
			this.list[allItemsIndex].numUnRead = numUnRead;
			if(!disableNotification) {
				this.notifyOfFeedUpdate(allItemsIndex, false);
			}
		} else {
			Mojo.Log.warn("Something went wrong: no allItems feed found!");
		}
	},
	
	/**
	 * Mark all stories of the given feed as being read.
	 * 
	 * @param {int}	index		Index of the feed
	 */
	markAllRead: function(index) {
		if((index >= 0) && (index < this.list.length)) {
			if(this.list[index].type == "allItems") {
				for(var j = 0; j < this.list.length; j++) {
					this.list[j].numUnRead = 0;
					for(var k = 0; k < this.list[j].stories.length; j++) {
						this.list[j].stories[k].isRead = true;
					}
					this.notifyOfFeedUpdate(j, false);
				}
			} else {
				this.list[index].numUnRead = 0;
				for(var i = 0; i < this.list[index].stories.length; i++) {
					this.list[index].stories[i].isRead = true;
				}
				this.updatePseudoFeeds();
				this.notifyOfFeedUpdate(index, false);
			}
			this.modified = true;
		}
	},
	
	/**
	 * Mark a given story as being read.
	 *
	 * @param {int} index		Index of the feed
	 * @param {int} story		Index of the story
	 */
	markStoryRead: function(index, story) {
		if((index >= 0) && (index < this.list.length)) {
			if((story >= 0) && (story < this.list[index].stories.length)) {
				if(! this.list[index].stories[story].isRead) {
					this.list[index].stories[story].isRead = true;
					this.list[index].numUnRead--;
					this.updatePseudoFeeds();
					this.modified = true;
				}
			}
		}
	},
	
	/**
	 * Mark all stories of the given feed as being unread.
	 *  
	 * @param {int} index		Index of the feed
	 */
	markAllUnRead: function(index) {
		if((index >= 0) && (index < this.list.length)) {
			if(this.list[index].type == "allItems") {
				for(var j = 0; j < this.list.length; j++) {
					this.list[j].numUnRead = this.list[j].stories.length;
					for(var k = 0; k < this.list[j].stories.length; j++) {
						this.list[j].stories[k].isRead = false;
					}
					this.notifyOfFeedUpdate(j, false);
				}
			} else {
				this.list[index].numUnRead = this.list[index].stories.length;
				for(var i = 0; i < this.list[index].stories.length; i++) {
					this.list[index].stories[i].isRead = false;
				}
				this.updatePseudoFeeds();
				this.notifyOfFeedUpdate(index, false);
			}
			this.modified = true;
		}
	},

	/**
	 * Mark a feed as being seen (not new).
	 *
	 * @param {int} index		Index of the feed to process
	 */
	markSeen: function(index) {
		if((index >= 0) && (index < this.list.length)) {
			if(this.list[index].type == "allItems") {
				for(var j = 0; j < this.list.length; j++) {
					for(var k = 0; k < this.list[j].stories.length; k++) {
						this.list[j].stories[k].isNew = false;
					}
					this.list[j].numNew = 0;
				}
			} else {
				for(var i = 0; i < this.list[index].stories.length; i++) {
					this.list[index].stories[i].isNew = false;
				}
				this.list[index].numNew = 0;
				this.updatePseudoFeeds();
			}
			this.modified = true;
		}
	},
	
	/**
	 * Delete a given feed.
	 *
	 * @param {int} index		Index of the feed to delete
	 */
	deleteFeed: function(index) {
		if((index >= 0) && (index < this.list.length)) {
			this.list.splice(index, 1);
			this.updatePseudoFeeds();
			this.modified = true;
		}
	},
	
	/**
	 * Exchange two feeds.
	 *
	 * @param {int} a			Index of the first feed
	 * @param {int} b			Index of the second feed
	 */
	exchangeFeeds: function(a, b) {
		if((a >= 0) && (a < this.list.length) && (b >= 0) && (b < this.list.length)) {
			var from = this.list[a];
			var to   = this.list[b];
			this.list[a] = to;
			this.list[b] = from;
			this.modified = true;
		}
	},
	
	/**
	 * Return the feed's title.
	 *
	 * @param {Object} feed		a feed object
	 * @return {String}			the feed's title
	 */
	getFeedTitle: function(feed) {
		switch(feed.type) {
			case "allItems":	return $L("All items");
			case "allUnRead":	return $L("All unread items");
			case "allNew":		return $L("All new items");
			
			default:
				return feed.title;
		}
	},
	
	/**
	 * Return the feed's url.
	 *
	 * @param {Object} feed		a feed object
	 * @return {String}			the feed's url
	 */
	getFeedURL: function(feed) {
		switch(feed.type) {
			case "allItems":	return $L("Aggregation of all feeds");
			case "allUnRead":	return $L("Aggregation of all unread items");
			case "allNew":		return $L("Aggregation of all new items");
			
			default:
				return feed.url;
		}		
	},
	
	/**
	 * Return a feeds header icon class.
	 *
	 * @param {Object} feed		a feed object
	 * @return {String}			the header icon class
	 */
	getFeedHeaderIcon: function(feed) {
		switch(feed.type) {
			case "allItems":
			case "allUnRead":
			case "allNew":
				return "allitems";
			
			case "RDF":
			case "rss":
				return "rss";
				
			case "atom":
				return "atom";
			
			default:
				return "";
		}
	}
});
