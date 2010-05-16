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

var feedProto = Class.create({
	title:				"",
	url:				"",
	feedOrder:			0,
	enabled:			1,
	showPicture:		1,
	showMedia:			1,
	showListSummary:	1,
	showDetailSummary:	1,
	showListCaption:	1,
	showDetailCaption:	1,
	sortMode:			0,
	allowHTML:			1
});

var feeds = Class.create ({
	list: [],			// contains the individual feeds

	db: {},				// takes the feed database
	connStatus: {},		// takes the connection state service
	spooler: {},		// action spooler
	cpConverter: {},	// codepage converter
	dateConverter: {},	// date converter

	interactiveUpdate: false,		// true if the update is interactive
	changingFeed: false,			// true if a feed is changed

	/** @private
	 *
	 * Initializing.
	 */	
	initialize: function() {
		this.spooler = new spooler();
		this.cpConverter = new codepageConverter();
		this.dateConverter = new dateConverter();
		this.db = new database();	
	},
	
	/**
	 * Updates a feed.
	 * 
	 * @param url	{String} 	URL of the feed to update.
	 */
	enqueueUpdate: function(url) {
		this.updateInProgress = true;
		this.spooler.addAction(this.doUpdateFeed.bind(this, url), url, true);
	},
	
	/**
	 * Update all feeds.
	 */
	enqueueUpdateAll: function() {
		Mojo.Log.info("FEEDLIST> Full update requested");
		this.db.getUpdatableFeeds(this.enqueueUpdateList.bind(this));
	},
	
	/** @private
	 *
	 * Called from the database with a list of all updatable feeds.
	 */
	enqueueUpdateList: function(urls) {
		if(urls.length > 0) {
			this.spooler.beginUpdate();
			for(var i = 0; i < urls.length; i++) {
				this.enqueueUpdate(urls[i]);
			}
			this.spooler.endUpdate();
		}
	},
	
	/** @private
	 *
	 * Called by the spooler to update a feed.
	 */
	doUpdateFeed: function(url) {
		this.connStatus = new Mojo.Service.Request('palm://com.palm.connectionmanager', {
			method: 'getstatus',
			parameters: {},
			onSuccess: this.getConnStatusSuccess.bind(this, url),
			onFailure: this.getConnStatusFailed.bind(this, url)
		});		
	},

	/** @private
	 * 
	 * Called when the connection status could be retrieved.
	 *
	 * @param {int} url			Feed url to be updated
	 * @param {Object} result	Information about the connection status
	 */	
	getConnStatusSuccess: function(url, result) {
		if(result.isInternetConnectionAvailable) {
			this.updateInProgress = true;
			this.db.beginStoryUpdate(url);
			var request = new Ajax.Request(url, {
	    	        method: "get",
					evalJS: "false",
	        	    evalJSON: "false",
	            	onSuccess: this.updateFeedSuccess.bind(this, url),
	            	onFailure: this.updateFeedFailed.bind(this, url)});
		} else {
			Mojo.Log.info("FEEDS> No internet connection available");
			this.spooler.nextAction();
		}
	},
	
	/** @private
	 * 
	 * Called when the connection status could not be retrieved.
	 *
	 * @param {int} url			Feed url to be updated
	 * @param {Object} result	Information about the connection status
	 */	
	getConnStatusFailed: function(url, result) {
		Mojo.Log.warn("FEEDS> Unable to determine connection status");
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
		summary = FeedReader.stripCDATA(summary);
		
		// Remove potentially dangerous tags.
		summary = summary.replace(/<script[^>]*>(.*?)<\/script>/ig, "");
		summary = summary.replace(/(<script([^>]*)\/>)/ig, "");
		summary = summary.replace(/<iframe[^>]*>(.*?)<\/iframe>/ig, "");
		summary = summary.replace(/(<iframe([^>]+)\/>)/ig, "");
		
        summary = summary.replace(/(\{([^\}]+)\})/ig, "");
        summary = summary.replace(/digg_url .../, "");
		
		// Parse some BBCodes.
		summary = summary.replace(/\[i\](.*)\[\/i\]/ig, '<span class="italic">$1</span>');
		summary = summary.replace(/\[b\](.*)\[\/b\]/ig, '<span class="bold">$1</span>');
		summary = summary.replace(/\[u\](.*)\[\/u\]/ig, '<span class="underline">$1</span>');
        summary = unescape(summary);
		return summary;	
	},
	
	/** @private
	 * 
	 * Determine the type of the given feed.
	 * 
	 * @param {int} url				feed url
	 * @param {Object} transport	Ajax transport
	 * @return {Boolean}			true if type is supported
	 */
	determineFeedType: function(url, transport) {
		var feedType = transport.responseXML.getElementsByTagName("rss");
		var errorMsg = {};
		
		if(transport.responseText.length === 0) {
			if(this.changingFeed) {
				errorMsg = new Template($L("The Feed '#{title}' does not return data."));
				FeedReader.showError(errorMsg, { title: url });
			}
			Mojo.Log.info("FEEDS> Empty responseText in", url);
			return this.db.setFeedType(url, feedTypes.ftUnknown);
		}

		if(feedType.length > 0) {
			return this.db.setFeedType(url, feedTypes.ftRSS);
		} else {    
			feedType = transport.responseXML.getElementsByTagName("RDF");
			if (feedType.length > 0) {
				return this.db.setFeedType(url, feedTypes.ftRDF);
			} else {
				feedType = transport.responseXML.getElementsByTagName("feed");
				if (feedType.length > 0) {
					return this.db.setFeedType(url, feedTypes.ftATOM);
				} else {
					if (this.changingFeed) {
						errorMsg = new Template($L("The format of Feed '#{title}' is unsupported."));
						FeedReader.showError(errorMsg, { title: url });
					}
					Mojo.Log.info("FEEDS> Unsupported feed format in", url);
					return this.db.setFeedType(url, feedTypes.ftUnknown);
				}
			}
		}
	},
	
	/** @private
	 *
	 * Parse RDF Feed data.
	 *
	 * @param {String} URL of the feed to be parsed
	 * @param {Object} transport
	 */
	parseAtom: function(feedUrl, transport) {
		var enclosures = {}, story = {};
		var url = "", enc = 0, type = "", title = "";
		var el = 0;
		
		var atomItems = transport.responseXML.getElementsByTagName("entry");
		var l = atomItems.length;
		for (var i = 0; i < l; i++) {
			try {
				story = {
					title:		"",
					summary:	"",
					url:		[],
					picture:	"",
					audio:		"",
					video:		"",
					pubdate:	0,
					uuid:		""
				};
				
				if(atomItems[i].getElementsByTagName("title") &&
				   atomItems[i].getElementsByTagName("title").item(0)) {
					story.title = unescape(atomItems[i].getElementsByTagName("title").item(0).textContent);
				}
				if (atomItems[i].getElementsByTagName("summary") &&
					atomItems[i].getElementsByTagName("summary").item(0)) {
					story.summary = this.reformatSummary(atomItems[i].getElementsByTagName("summary").item(0).textContent);
				}
				
				// Analyse the enclosures.
				enclosures = atomItems[i].getElementsByTagName("link");
				if(enclosures && (enclosures.length > 0)) {
					el = enclosures.length;
					for(enc = 0; enc < el; enc++) {
						rel = enclosures.item(enc).getAttribute("rel");
						url = enclosures.item(enc).getAttribute("href");
						type = enclosures.item(enc).getAttribute("type");

						if(!type) {
							type = "";
						}
						if(url && (url.length > 0)) {
							if(url.match(/.*\.htm(l){0,1}/i)){
								title = enclosures.item(enc).getAttribute("title");
								if((title === null) || (title.length === 0)) {
									title = "Weblink";
								}
								story.url.push({
									title:	title,
									href:	url
								});
							} else if(rel && rel.match(/enclosure/i)) {
								if(url.match(/.*\.jpg/i) ||
								   url.match(/.*\.jpeg/i) ||
								   url.match(/.*\.gif/i) ||
								   url.match(/.*\.png/i)) {
									story.picture = url;
								} else if(url.match(/.*\.mp3/i) ||
										  (url.match(/.*\.mp4/i) && type.match(/audio\/.*/i)) ||
										  url.match(/.*\.wav/i) ||
										  url.match(/.*\.aac/i)) {
									story.audio = url;
								} else if(url.match(/.*\.mpg/i) ||
										  url.match(/.*\.mpeg/i) ||
										  (url.match(/.*\.mp4/i) && type.match(/video\/.*/i)) ||
										   url.match(/.*\.avi/i)) {
									story.video = url;
								}
							}
						}
					}
				}
				
				// Set the publishing date.
				if (atomItems[i].getElementsByTagName("updated") &&
					atomItems[i].getElementsByTagName("updated").item(0)) {
					story.pubdate = this.dateConverter.dateToInt(atomItems[i].getElementsByTagName("updated").item(0).textContent);
				}
				
				// Set the unique id.
				if (atomItems[i].getElementsByTagName("id") &&
					atomItems[i].getElementsByTagName("id").item(0)) {
					story.uuid = atomItems[i].getElementsByTagName("id").item(0).textContent;
				} else {
					story.uuid = story.url;
				}
				
				this.db.addOrEditStory(feedUrl, story);
			} catch(e) {
				Mojo.Log.logException(e);
			}
		}
	},
	
	/** @private
	 *
	 * Parse RSS Feed data.
	 *
	 * @param {String} URL of the feed to be parsed
	 * @param {Object} transport
	 */
	parseRSS: function(feedUrl, transport) {
		var enclosures = {}, story = {};
		var url = "", type = "", enc = 0;
		var el = 0;
		
		var rssItems = transport.responseXML.getElementsByTagName("item");
		var l = rssItems.length;
		for (var i = 0; i < l; i++) {
			try {
				story = {
					title: 		"",
					summary:	"",
					url:		[],
					picture:	"",
					audio:		"",
					video:		"",
					pubdate:	0,
					uuid:		""
				};
				
				if(rssItems[i].getElementsByTagName("title") &&
				   rssItems[i].getElementsByTagName("title").item(0)) {
					story.title = unescape(rssItems[i].getElementsByTagName("title").item(0).textContent);
				}
				if(rssItems[i].getElementsByTagName("description") &&
				   rssItems[i].getElementsByTagName("description").item(0)) {
					story.summary = this.reformatSummary(rssItems[i].getElementsByTagName("description").item(0).textContent);
				}
				if(rssItems[i].getElementsByTagName("link") &&
				   rssItems[i].getElementsByTagName("link").item(0)) {
					story.url.push({
						title:	"Weblink",
						href:	rssItems[i].getElementsByTagName("link").item(0).textContent
					});
				}
				
				// Analyse the enclosures.
				enclosures = rssItems[i].getElementsByTagName("enclosure");
				if(enclosures && (enclosures.length > 0)) {					
					el = enclosures.length;
					for(enc = 0; enc < el; enc++) {
						url = enclosures.item(enc).getAttribute("url");
						type = enclosures.item(enc).getAttribute("type");
						if(!type) {
							type = "";
						}
						if(url && (url.length > 0)) {
							if(url.match(/.*\.jpg/i) ||
							   url.match(/.*\.jpeg/i) ||
							   url.match(/.*\.gif/i) ||
							   url.match(/.*\.png/i)) {
								story.picture = url;
							} else if(url.match(/.*\.mp3/i) ||
									  (url.match(/.*\.mp4/i) && type.match(/audio\/.*/i)) ||
									  url.match(/.*\.wav/i) ||
									  url.match(/.*\.aac/i)) {
								story.audio = url;
							} else if(url.match(/.*\.mpg/i) ||
									  url.match(/.*\.mpeg/i) ||
									  (url.match(/.*\.mp4/i) && type.match(/video\/.*/i)) ||
									  url.match(/.*\.avi/i) ||
									  url.match(/.*\.m4v/i)) {
								story.video = url;
							}
						}
					}
				}
				
				// Set the publishing date.
				if(rssItems[i].getElementsByTagName("pubDate") &&
				   rssItems[i].getElementsByTagName("pubDate").item(0)) {
				   story.pubdate = this.dateConverter.dateToInt(rssItems[i].getElementsByTagName("pubDate").item(0).textContent);
				} else if (rssItems[i].getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "date") &&
						   rssItems[i].getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "date").item(0)) {
					story.pubdate = this.dateConverter.dateToInt(rssItems[i].getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "date").item(0).textContent);
				}
				
				// Set the unique id.
				if(rssItems[i].getElementsByTagName("guid") &&
				   rssItems[i].getElementsByTagName("guid").item(0)) {
					story.uuid = rssItems[i].getElementsByTagName("guid").item(0).textContent;
				} else {
					story.uuid = story.title;
				}
				
				this.db.addOrEditStory(feedUrl, story);
			} catch(e) {
				Mojo.Log.logException(e);
			}
		}
	},
	
	/** @private
	 *
	 * Parse RDF Feed data.
	 *
	 * @param {String} URL of the feed to be parsed
	 * @param {Object} transport
	 */
	parseRDF: function(feedUrl, transport) {
		// Currently we do the same as for RSS.
		this.parseRSS(feedUrl, transport);
	},
	
	/** @private
	 * 
	 * Called when an Ajax request succeeds.
	 * 
	 * @param {String} URL of the feed to be parsed
	 * @param {Object} transport
	 */
	updateFeedSuccess: function(feedUrl, transport) {
		try {
			if((transport.responseXML === null) && (transport.responseText !== null)) {
				Mojo.Log.info("FEEDS> Manually converting feed info to xml");
				transport.responseXML = new DOMParser().parseFromString(transport.responseText, "text/xml");
				Mojo.Log.info(transport.responseText);
			}
			
			var type = this.determineFeedType(feedUrl, transport);
			switch(type) {
				case feedTypes.ftRDF:
					this.parseRDF(feedUrl, transport);
					break;
					
				case feedTypes.ftRSS:
					this.parseRSS(feedUrl, transport);
					break;
					
				case feedTypes.ftATOM:
					this.parseAtom(feedUrl, transport);
					break;
			}				
			this.db.endStoryUpdate(feedUrl, type != feedTypes.ftUnknown);
		} catch(e) {
			Mojo.Log.logException(e);
			this.db.endStoryUpdate(feedUrl, false);
		}
		this.spooler.nextAction();
	},
	
	/** @private
	 * 
	 * Called when an Ajax request fails.
	 * 
	 * @param {Object} url
	 * @param {Object} transport
	 */
	updateFeedFailed: function(url, transport) {
		try {
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
			Mojo.Log.warn("FEEDS> Feed", url, "is defect; disabling feed; error:", error);
			if (this.changingFeed) {
				this.db.disableFeed(url);
				var errorMsg = new Template($L("The Feed '#{title}' could not be retrieved. The server responded: #{err}. The Feed was automatically disabled."));
				FeedReader.showError(errorMsg, { title: url, err: error} );
			}
		} catch(e) {
			Mojo.Log.logException(e);
		}
		this.db.endStoryUpdate(url, false);	// Don't delete old storys.
		this.spooler.nextAction();
	},
	
	/**
	 * Mark all stories of the given feed as being read.
	 * 
	 * @param {Object}	feed		feed object
	 */
	markAllRead: function(feed) {
		this.db.markAllRead(feed, 1, function() {
			Mojo.Controller.getAppController().sendToNotificationChain({ type: "feedlist-changed" });
		});
	},
	
	/**
	 * Mark a given story as being read.
	 *
	 * @param {Object} story	story object
	 */
	markStoryRead: function(story) {
		this.db.markStoryRead(story);
	},
	
	/**
	 * Mark all stories of the given feed as being unread.
	 *  
	 * @param {Object} feed		feed object
	 */
	markAllUnRead: function(feed) {
		this.db.markAllRead(feed, 0, function() {
			Mojo.Controller.getAppController().sendToNotificationChain({ type: "feedlist-changed" });
		});
	},

	/**
	 * Set a story's isStarred flag.
	 *
	 * @param	story	{Object}	story object
	 */
	markStarred: function(story) {
		this.db.markStarred(story);
	},
	
	/**
	 * Delete a given feed.
	 *
	 * @param id	{int} id		ID of the feed to delete
	 */
	deleteFeed: function(id) {
		this.db.deleteFeed(id);
		Mojo.Controller.getAppController().sendToNotificationChain({ type: "feedlist-deletedfeed" });
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
		
		this.db.reOrderFeed(fromIndex, toIndex);
	},
	
	/** @private
	 *
	 * Called when editing a feed succeeds.
	 *
	 * @param	url		{String}	url of the edited feed
	 */
	onAddOrEditFeedSuccess: function(url) {
		Mojo.Controller.getAppController().sendToNotificationChain({ type: "feedlist-changed" });			
		this.changingFeed = true;
		this.enqueueUpdate(url);
	},
	
	/**
	 * Add a new feed or edit an existing one.
	 * 
	 * @param feed		{Object} 	feed object
	 */
	addOrEditFeed: function(feed) {
		this.db.addOrEditFeed(feed, this.onAddOrEditFeedSuccess.bind(this, feed.url));
	},
	
	getFeedTitle: function(feed) {
		switch(feed.feedType) {
			case feedTypes.ftStarred:	return $L("Starred items");
			case feedTypes.ftAllItems:	return $L("All items");
		}
		return feed.title;
	},
	
	getFeedURL: function(feed) {
		switch(feed.feedType) {
			case feedTypes.ftStarred:	return $L("All starred items");
			case feedTypes.ftAllItems:	return $L("Aggregation of all items");
		}	
		return feed.url;		
	},
	
	/**
	 * Return a feeds icon class.
	 *
	 * @param	feed	{Object} 	a feed object
	 * @return			{String}	the header icon class
	 */
	getFeedIconClass: function(feed, ignoreEnabled, ignoreUnknown) {
		var iconClass = "";
		switch(feed.feedType) {
			case feedTypes.ftAllItems:	iconClass = "allitems";	break;
			case feedTypes.ftStarred:	iconClass = "starred";	break;
			case feedTypes.ftRDF:
			case feedTypes.ftRSS:		iconClass = "rss";		break;
			case feedTypes.ftATOM:		iconClass = "atom";		break;
			default:					iconClass = ignoreUnknown ? "rss" : "unknown"; break;
		}
		if(!ignoreEnabled && !feed.enabled) {
			iconClass += ' disabled';
		}
		return iconClass;
	},
		
	getFeeds: function(filter, offset, count, onSuccess) {
		this.db.getFeeds(filter, offset, count, onSuccess);
	},

	getFeed: function(id, onSuccess) {
		this.db.getFeed(id, onSuccess);
	},
	
	getFeedCount: function(filter, onSuccess) {
		this.db.getFeedCount(filter, onSuccess);
	},
	
	getStories: function(feed, filter, offset, count, onSuccess) {
		this.db.getStories(feed, filter, offset, count, onSuccess);
	},
	
	getStoryCount: function(feed, filter, onSuccess) {
		this.db.getStoryCount(feed, filter, onSuccess);
	},
	
	getStoryIDList: function(feed, onSuccess) {
		this.db.getStoryIDList(feed, onSuccess);
	},

	getStory: function(id, onSuccess) {
		this.db.getStory(id, onSuccess);
	},
	
	isReady: function() {
		return (this.db.ready && (!this.db.loading));
	},
	
	isUpdating: function() {
		return this.spooler.hasWork();
	}
});
