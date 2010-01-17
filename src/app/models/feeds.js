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

	/** @private
	 *
	 * Initializing.
	 */	
	initialize: function() {
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
		this.db = new Mojo.Depot({name: "FeedListDB", version: 1, estimatedSize: 100000, replace: false},
			this.openDBSuccessHandler,
            this.openDBFailedHandler);
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
			this.list = [];
        } else {
            this.list = data;
        }
		Mojo.Controller.getAppController().sendToNotificationChain({type: "feedlist-loaded"});
        this.update();
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
	 */
	addFeed: function(title, url, enabled) {
		this.interactiveUpdate = true;
		if (title === "") {
			title = "News Feed";
		}
			
		for(var i; i < this.list.length; i++) {
			if (this.list[i].url == url) {
				this.editFeed(i, title, url, enabled);
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
			updated: true,
			stories: []
		});
		this.modified = true;
		Mojo.Controller.getAppController().sendToNotificationChain({ type: "feedlist-newfeed" });
		this.updateFeed(this.list.length - 1);
	},
	
	/**
	 * Update the properties of a feed.
	 * 
	 * @param {int} index
	 * @param {String} title
	 * @param {String} url
	 * @param {Boolean} enabled
	 */
	editFeed: function(index, title, url, enabled) {
		if((index >= 0) && (index < this.list.length)) {
			this.interactiveUpdate = true;
			this.list[index].title = title;
			this.list[index].url = url;
			this.list[index].enabled = enabled;
			this.modified = true;
			Mojo.Controller.getAppController().sendToNotificationChain({type: "feedlist-editedfeed"});
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
			this.notifyOfFeedUpdate(index);
			var request = new Ajax.Request(this.list[index].url, {
	    	        method: "get",
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
		if(summary.length > 130) {
			summary = summary.substring(0, 120) + '...';
		}
		return summary;	
	},
	
	/** @private
	 * 
	 * Reformat a date to system locale, supports dc:date and RFC 822 format.
	 * 
	 * @param {String} dateString	string representing the date to reformat
	 * @return {String}				reformatted date 
	 */
	reformatDate: function(dateString) {
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
					case "Jan":	d.setMonth(1); break;
					case "Feb": d.setMonth(2); break;
					case "Mar": d.setMonth(3); break;
					case "Apr": d.setMonth(4); break;
					case "May": d.setMonth(5); break;
					case "Jun": d.setMonth(6); break;
					case "Jul": d.setMonth(7); break;
					case "Aug": d.setMonth(8); break;
					case "Sep": d.setMonth(9); break;
					case "Oct": d.setMonth(10); break;
					case "Nov": d.setMonth(11); break;
					case "Dec": d.setMonth(12); break;
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
						d.setMonth(parseInt(dateComponents[1], 10));
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
			return "";
		}
		
		return Mojo.Format.formatDate(d, "medium");
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
						var errorMsg = new Template($L("The format of Feed '#{title}' is unsupported."));
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
	parseAtom: function(transport) {
		var container = [];
		var atomItems = transport.responseXML.getElementsByTagName("entry");
		for (var i = 0; i < atomItems.length; i++) {
			try {
				story = {
					title: unescape(atomItems[i].getElementsByTagName("title").item(0).textContent),
					summary: "",
					url: atomItems[i].getElementsByTagName("link").item(0).getAttribute("href"),
					date: "",
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
					story.date = this.reformatDate(atomItems[i].getElementsByTagName("updated").item(0).textContent);
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
	parseRSS: function(transport) {
		var container = [];
		var rssItems = transport.responseXML.getElementsByTagName("item");
		if(!rssItems) {
			Mojo.Log.warn("Feed is empty");
			return container;
		} else {
			Mojo.Log.info("Feed contains", rssItems.length, "items");
		}
		
		for (var i = 0; i < rssItems.length; i++) {
			try {
				story = {
					title: unescape(rssItems[i].getElementsByTagName("title").item(0).textContent),
					summary: this.reformatSummary(rssItems[i].getElementsByTagName("description").item(0).textContent),
					url: rssItems[i].getElementsByTagName("link").item(0).textContent,
					date: "",
					uid: "",
					isRead: false,
					isNew: true
				};
				
				// Set the publishing date.
				if (rssItems[i].getElementsByTagName("pubDate") && rssItems[i].getElementsByTagName("pubDate").item(0)) {
					story.date = this.reformatDate(rssItems[i].getElementsByTagName("pubDate").item(0).textContent);
				} else if (rssItems[i].getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "date") &&
						   rssItems[i].getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "date").item(0)) {
					story.date = this.reformatDate(rssItems[i].getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "date").item(0).textContent);
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
	parseRDF: function(transport) {
		// Currently we do the same as for RSS.
		return this.parseRSS(transport);
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
			if ((transport.responseXML === null) && (transport.responseText !== null)) {
				Mojo.Log.info("Manually converting feed info to xml");
				transport.responseXML = new DOMParser().parseFromString(transport.responseText, "text/xml");
			}
			
			if(this.determineFeedType(index, transport)) {
				Mojo.Log.info("Feed", index, "is of type", this.list[index].type);
				var newStories = [];
				
				switch(this.list[index].type) {
					case "RDF":
						newStories = this.parseRDF(transport);
						break;
						
					case "rss":
						newStories = this.parseRSS(transport);
						break;
						
					case "atom":
						newStories = this.parseAtom(transport);
						break;
				}
				
				Mojo.Log.info("Feed", index, "retrieved;", newStories.length, "stories");
				var isNew;										
				this.list[index].numUnRead = newStories.length;
				this.list[index].numNew = 0;
				
				for (var i = 0; i < newStories.length; i++) {
					for (var j = 0; j < this.list[index].stories.length; j++) {
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
		this.leaveActivity();
	},

	/**
	 * Updates all feeds.
	 */
	update: function() {
		var i;
		
		if(this.list.length < 1) {
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
	 * Clears the feed list.
	 */
	clear: function() {
		Mojo.Log.info("Feedlist is about to be cleared");
		this.list = {};
		this.save();
		this.load();
	},
	
	/**
	 * Mark all stories of the given feed as being read.
	 * 
	 * @param {int}	index		Index of the feed
	 */
	markAllRead: function(index) {
		if ((index >= 0) && (index < this.list.length)) {
			this.list[index].numUnRead = 0;
			for(var i = 0; i < this.list[index].stories.length; i++) {
				this.list[index].stories[i].isRead = true;
			}
			this.modified = true;
			this.notifyOfFeedUpdate(index, false);
		}
	},
	
	/**
	 * Mark a given story as being read.
	 *
	 * @param {int} index		Index of the feed
	 * @param {int} story		Index of the story
	 */
	markStoryRead: function(index, story) {
		if ((index >= 0) && (index < this.list.length)) {
			if((story >= 0) && (story < this.list[index].stories.length)) {
				this.list[index].stories[story].isRead = true;
				this.list[index].numUnRead--;
				this.modified = true;
			}
		}
	},
	
	/**
	 * Mark all stories of the given feed as being unread.
	 *  
	 * @param {int} index		Index of the feed
	 */
	markAllUnRead: function(index) {
		if ((index >= 0) && (index < this.list.length)) {
			this.list[index].numUnRead = this.list[index].stories.length;
			for(var i = 0; i < this.list[index].stories.length; i++) {
				this.list[index].stories[i].isRead = false;
			}
			this.modified = true;
			this.notifyOfFeedUpdate(index, false);
		}		
	},

	/**
	 * Mark a feed as being seen (not new).
	 *
	 * @param {int} index		Index of the feed to process
	 */
	markSeen: function(index) {
		if ((index >= 0) && (index < this.list.length)) {
			for(var i = 0; i < this.list[index].stories.length; i++) {
				this.list[index].stories[i].isNew = false;
			}
			this.list[index].numNew = 0;
			this.modified = true;
		}
	},
	
	/**
	 * Delete a given feed.
	 *
	 * @param {int} index		Index of the feed to delete
	 */
	deleteFeed: function(index) {
		if ((index >= 0) && (index < this.list.length)) {
			this.list.splice(index, 1);
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
		if ((a >= 0) && (a < this.list.length) && (b >= 0) && (b < this.list.length)) {
			var from = this.list[a];
			var to   = this.list[b];
			this.list[a] = to;
			this.list[b] = from;
			this.modified = true;
		}
	}
});
