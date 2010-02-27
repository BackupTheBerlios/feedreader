/*
 *		app/models/feeds.js - Feed data model
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

var feeds = Class.create ({
	list: [],		// contains the individual feeds

	db: {},				// takes the depot object
	activity: {},		// takes the activity service
	connStatus: {},		// takes the connection state service
	cookie: {},			// takes the database info cookie
	spooler: {},		// action spooler
	converter: {},		// codepage converter
	dateConverter: {},	// date converter

	fullUpdateInProgress: false,	// true if a full update is in progress
	updateInProgress: false,		// true if any kind of update is in progress
	interactiveUpdate: false,		// true if the update is interactive
	modified: false,				// used by save() to indicate changes
	saveInProgress: false,			// true if a save process is ongoing
	activityLevel: 0,				// activity counter
	properties: {
		migratingFrom: 1			// db version loaded
	},

	/** @private
	 *
	 * Initializing.
	 */	
	initialize: function() {
		this.spooler = new spooler();
		this.converter = new codepageConverter();
		this.dateConverter = new dateConverter();
		
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
		
		this.doSaveHandler = this.doSave.bind(this);
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
			if(this.properties.migratingFrom < 3) {
				data = this.migrateV2(data);
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
	 * Called when the feed list cannot be retrieved.
	 */
	loadFeedListFailed: function() {
		Mojo.Log.warn("unable to retrieve feedlist");
	},

	/**
	 * Save the feed list to a depot.
	 */
	save: function() {
		this.spooler.addAction(this.doSaveHandler, "feedmodel.save", true);
	},
	
	/** @private
	 *
	 */
	doSave: function() {
		this.saveInProgress = true;
		this.db.add("feedList", this.list,
					this.saveFeedListSuccessHandler,
					this.saveFeedListFailedHandler);
	},
	
	/** @private
	 *
	 * Called when saving the feed list succeeds.
	 */
	saveFeedListSuccess: function() {
		this.saveInProgress = false;
		Mojo.Log.info("feed list saved");
		
		this.spooler.nextAction();
	},
	
	/** @private
	 *
	 * Called when saving the feed list fails.
	 */
	saveFeedListFailed: function(transaction, result) {
		this.saveInProgress = false;
		Mojo.Log.warn("feed list could not be saved: ", result.message);

		this.spooler.nextAction();
	},
	
	/**
	 * Add a new feed.
	 * 
	 * @param {String} title
	 * @param {String} url
	 * @param {Boolean} enabled
	 * @param {Int} viewMode
	 * @param {Boolean} showPicture
	 * @param {Boolean} showMedia
	 */
	addFeed: function(title, url, enabled, viewMode, showPicture, showMedia) {
		this.interactiveUpdate = true;
		if (title === "") {
			title = "RSS Feed";
		}
			
		for(var i; i < this.list.length; i++) {
			if (this.list[i].url == url) {
				this.editFeed(i, title, url, enabled, viewmode, showPicture, showMedia);
				return;
			} 
		}
			
		this.list.push({
			title: title,
			url: url,
			type: "rss",
			uid: Math.uuid(15),
			numUnRead: 0,
			numNew: 0,
			enabled: enabled,
			viewMode: viewMode,
			showPicture: showPicture,
			showMedia: showMedia,
			preventDelete: false,
			updated: true,
			spinning: false,
			stories: []
		});
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
	 * @param {Boolean} showPicture
	 * @param {Boolean} showMedia
	 */
	editFeed: function(index, title, url, enabled, viewMode, showPicture, showMedia) {
		if((index >= 0) && (index < this.list.length)) {
			this.interactiveUpdate = true;
			this.list[index].title = title;
			this.list[index].url = url;
			this.list[index].enabled = enabled;
			this.list[index].viewMode = viewMode;
			this.list[index].showPicture = showPicture;
			this.list[index].showMedia = showMedia;			
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
	 * Gets called when setting the activity was successful.
	 */
	setActivitySuccess: function(response) {
		Mojo.Log.info("Successfully set activity");
	},
	
	/** @private
	 *
	 * Gets called when setting the acitivity failed.
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
			if((this.list[index].type == "allItems") || !this.list[index].enabled) {
				this.list[index].updated = true;
				this.list[index].spinning = false;
				return;
			}
			
			this.spooler.addAction(this.doUpdateFeed.bind(this, index), "feedmodel.updateFeed");
		}		
	},
	
	/** @private
	 *
	 * Called by the spooler to update a feed.
	 */
	doUpdateFeed: function(index) {
		this.connStatus = new Mojo.Service.Request('palm://com.palm.connectionmanager', {
			method: 'getstatus',
			parameters: {},
			onSuccess: this.getConnStatusSuccess.bind(this, index),
			onFailure: this.getConnStatusFailed.bind(this, index)
		});		
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
		this.spooler.nextAction();
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
			Mojo.Log.warn("Empty responseText in", this.list[index].url);
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
		var enclosures, enc, url, testurl, rel;
		
		var atomItems = transport.responseXML.getElementsByTagName("entry");
		for (var i = 0; i < atomItems.length; i++) {
			try {
				story = {
					title: unescape(atomItems[i].getElementsByTagName("title").item(0).textContent),
					summary: "",
					url: atomItems[i].getElementsByTagName("link").item(0).getAttribute("href"),
					picture: "",
					audio: "",
					video: "",
					intDate: 0,
					uid: "",
					isRead: false,
					isNew: true
				};
				
				// Set the summary. Normally this will be pulled out of the summary element,
				// but sometimes this element does not exist.
				if (atomItems[i].getElementsByTagName("summary") && atomItems[i].getElementsByTagName("summary").item(0)) {
					story.summary = this.reformatSummary(atomItems[i].getElementsByTagName("summary").item(0).textContent);
				} else if (atomItems[i].getElementsByTagName("content") && atomItems[i].getElementsByTagName("content").item(0)) {
					story.summary = this.reformatSummary(atomItems[i].getElementsByTagName("content").item(0).textContent);
				} else {
					story.summary = "";
				}
				
				// Analyse the enclosures.
				enclosures = atomItems[i].getElementsByTagName("link");
				if(enclosures && (enclosures.length > 0)) {
					for(enc = 0; enc < enclosures.length; enc++) {
						rel = enclosures.item(enc).getAttribute("rel");
						if(!rel || !rel.match(/enclosure/)) {
							continue;
						}
						
						url = enclosures.item(enc).getAttribute("href");
						if(url && (url.length > 0)) {
							testurl = url.toLowerCase();
							
							if(testurl.match(/.*\.jpg/) ||
							   testurl.match(/.*\.jpeg/) ||
							   testurl.match(/.*\.gif/) ||
							   testurl.match(/.*\.png/)) {
								story.picture = url;
							} else if(testurl.match(/.*\.mp3/) ||
									  testurl.match(/.*\.wav/) ||
									  testurl.match(/.*\.aac/)) {
								story.audio = url;
							} else if(testurl.match(/.*\.mpg/) ||
									  testurl.match(/.*\.mpeg/) ||
									  testurl.match(/.*\.avi/)) {
								story.video = url;
							}
						}
					}
				}
				
				// Set the publishing date.
				if (atomItems[i].getElementsByTagName("updated") && atomItems[i].getElementsByTagName("updated").item(0)) {
					story.intDate = this.dateConverter.dateToInt(atomItems[i].getElementsByTagName("updated").item(0).textContent);
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
				Mojo.Log.logException(e);
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
		var enclosures, url, testurl, enc;
		
		var rssItems = transport.responseXML.getElementsByTagName("item");
		for (var i = 0; i < rssItems.length; i++) {
			try {
				story = {
					title: unescape(rssItems[i].getElementsByTagName("title").item(0).textContent),
					summary: this.reformatSummary(rssItems[i].getElementsByTagName("description").item(0).textContent),
					url: rssItems[i].getElementsByTagName("link").item(0).textContent,
					picture: "",
					audio: "",
					video: "",
					intDate: 0,
					uid: "",
					isRead: false,
					isNew: true
				};
				
				// Analyse the enclosures.
				enclosures = rssItems[i].getElementsByTagName("enclosure");
				if(enclosures && (enclosures.length > 0)) {
					for(enc = 0; enc < enclosures.length; enc++) {
						url = enclosures.item(enc).getAttribute("url");
						if(url && (url.length > 0)) {
							testurl = url.toLowerCase();
							
							if(testurl.match(/.*\.jpg/) ||
							   testurl.match(/.*\.jpeg/) ||
							   testurl.match(/.*\.gif/) ||
							   testurl.match(/.*\.png/)) {
								story.picture = url;
							} else if(testurl.match(/.*\.mp3/) ||
									  testurl.match(/.*\.wav/) ||
									  testurl.match(/.*\.aac/)) {
								story.audio = url;
							} else if(testurl.match(/.*\.mpg/) ||
									  testurl.match(/.*\.mpeg/) ||
									  testurl.match(/.*\.avi/)) {
								story.video = url;
							}
						}
					}
				}
				
				// Set the publishing date.
				if (rssItems[i].getElementsByTagName("pubDate") && rssItems[i].getElementsByTagName("pubDate").item(0)) {
					story.intDate = this.dateConverter.dateToInt(rssItems[i].getElementsByTagName("pubDate").item(0).textContent);
				} else if (rssItems[i].getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "date") &&
						   rssItems[i].getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "date").item(0)) {
					story.intDate = this.dateConverter.dateToInt(rssItems[i].getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "date").item(0).textContent);
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
				Mojo.Log.logException(e);
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
			
			var contentType = transport.getHeader("Content-Type");
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
						newStories[i].title = this.converter.convert(contentType, newStories[i].title);
						newStories[i].summary = this.converter.convert(contentType, newStories[i].summary);
						
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
			Mojo.Log.logException(e);
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
			Mojo.Log.logException(e);
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
						if(this.list[i].type != "allItems") {
							n += this.list[i].numNew;
						}
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
				this.save();
			}
		} else {
			this.save();
		}
		this.updateInProgress = this.fullUpdateInProgress;
		this.interactiveUpdate = false;
		this.notifyOfFeedUpdate(index, false);
		this.updatePseudoFeeds();
		this.leaveActivity();
		
		this.spooler.nextAction();
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
		
		for(i = 0; i < this.list.length; i++) { 	// Reset update flag first.
			if(this.list[i].type != "allItems") {
				this.list[i].updated = false;
			}
		}
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
			this.save();
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
				}
			}
			this.save();
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
				this.save();
			} else {
				this.list[index].numUnRead = this.list[index].stories.length;
				for(var i = 0; i < this.list[index].stories.length; i++) {
					this.list[index].stories[i].isRead = false;
				}
				this.updatePseudoFeeds();
				this.notifyOfFeedUpdate(index, false);
			}
			this.save();
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
				this.save();
			} else {
				for(var i = 0; i < this.list[index].stories.length; i++) {
					this.list[index].stories[i].isNew = false;
				}
				this.list[index].numNew = 0;
				this.updatePseudoFeeds();
			}
			this.save();
		}
	},
	
	/**
	 * Delete a given feed.
	 *
	 * @param {int} index		Index of the feed to delete
	 */
	deleteFeed: function(index) {
		if((index >= 0) && (index < this.list.length)) {
			Mojo.Log.info("FEEDS> Deleting feed", index);
			this.list.splice(index, 1);
			this.save();
			this.updatePseudoFeeds();
		}
	},
	
	/**
	 * Move a feed in the list.
	 *
	 * @param {int} fromIndex	Feed to be moved
	 * @param {int} toIndex		Index to move it to
	 */
	moveFeed: function(fromIndex, toIndex) {
		if(fromIndex == toIndex) {
			return;
		}
		
		if((fromIndex >= 0) && (fromIndex < this.list.length) &&
		   (toIndex >= 0) && (toIndex < this.list.length)) {
			var elem = this.list.slice(fromIndex);
			this.list.splice(fromIndex, 1);
			var behind = this.list.slice(toIndex);
			this.list.splice(toIndex, this.list.length - toIndex);
			this.list.push(elem[0]);
			for(var i = 0; i < behind.length; i++) {
				this.list.push(behind[i]);
			}
			this.save();
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
				return "rss";
		}
	},
	
	/**
	 * Determine if the story captions should be shown.
	 * 
	 * @param {Object}		The feed to inspect
	 * @param {Boolean}		True if called from fullStoryView
	 */
	showCaption: function(feed, isDetailView) {
		var viewMode = parseInt(feed.viewMode, 10);
		var mode = isDetailView ? (viewMode >> 24) : (viewMode >> 16);		
		return (mode < 2);
	},
	
	/**
	 * Determine if the story summarys should be shown.
	 * 
	 * @param {Object}		The feed to inspect
	 * @param {Boolean}		True if called from fullStoryView
	 */
	showSummary: function(feed, isDetailView) {
		var viewMode = parseInt(feed.viewMode, 10);
		var mode = isDetailView ? (viewMode >> 24) : (viewMode >> 16);
		return (mode == 2) || (mode === 0);
	}
});
