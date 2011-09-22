/*
 *		source/models/feeds.js - Feedlist data model
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

	name:	"Feeds",
	kind:	"Component",

	components: [{
		name:		"webService",
		kind:		"WebService",
		method:		"get",
		handleAs:	"xml",
		onSuccess:	"updateFeedSuccess",
		onFailure:	"updateFeedFailed"
	}, {
		name:		"storyFormatter",
		kind:		"StoryFormatter"
	}, {
		name:		"dateFormatter",
		kind:		"DateFormatter"
	}, {
		name:		"cpConverter",
		kind:		"CodePageConverter"
	}, {
		name:		"connChecker",
		kind:		"ConnectionChecker"
	}],

	interactiveUpdate: false,		// true if the update is interactive
	changingFeed: false,			// true if a feed is changed
	updateWhenReady: true,

	/**
	 * Constructor.
	 */
	create: function() {
		this.inherited(arguments);
		this.updateWhenReady = enyo.application.prefs.updateOnStart;
	},

	/**
	 * Returns the story formatter.
	 */
	getStoryFormatter: function() {
		return this.$.storyFormatter;
	},

	/**
	 * Returns the date formatter kind.
	 */
	getDateFormatter: function() {
		return this.$.dateFormatter;
	},

	/**
	 * Updates a feed.
	 *
	 * @param feed	{Object} 	feed to update
	 */
	enqueueUpdate: function(feed) {
		this.updateInProgress = true;
		enyo.application.spooler.addAction(enyo.bind(this, this.doUpdateFeed, feed), feed.id, true);
	},

	/**
	 * Update all feeds.
	 */
	enqueueUpdateAll: function() {
		this.log("FEEDLIST> Full update requested");
		enyo.application.db.getUpdatableFeeds(enyo.bind(this, this.enqueueUpdateList));
	},

	/** @private
	 *
	 * Called from the database with a list of all updatable feeds.
	 */
	enqueueUpdateList: function(feeds) {
		if(feeds.length > 0) {
			enyo.application.spooler.beginUpdate();
			for(var i = 0; i < feeds.length; i++) {
				this.enqueueUpdate(feeds[i]);
			}
			enyo.application.spooler.addAction(enyo.bind(this, this.getNewCount), "getNewCount", true);
			enyo.application.spooler.endUpdate();
		}
	},

	/** @private
	 *
	 * Called by the spooler to update a feed.
	 *
	 * @param	feed	{object}	feed object to update
	 */
	doUpdateFeed: function(feed) {
		try {
			this.$.connChecker.checkConnection(
				enyo.bind(this, this.haveConnection, feed),
				enyo.bind(this, this.haveNoConnection, feed)
			);
		} catch(e) {
			this.error("FEEDS EXCEPTION>", e);
			enyo.application.spooler.nextAction();
		}
	},

	/** @private
	 *
	 * Called when the connection status could be retrieved.
	 *
	 * @param feed		{object}	feed object to be updated
	 * @param result	{object}	information about the connection status
	 */
	haveConnection: function(feed) {
		try {
			this.log("FEEDS> Internet connection available, requesting", feed.url);
			this.updateInProgress = true;
			enyo.application.db.beginStoryUpdate(feed);

			var params = {};
			if(feed.username && feed.password) {
				params.username = feed.username;
				params.password = feed.password;
			}

			this.$.webService.call(params, {
				url:	feed.url,
				feed:	feed
			});
		} catch(e) {
			this.error("FEEDS EXCEPTION>", e);
			enyo.application.spooler.nextAction();
		}
	},

	/** @private
	 *
	 * Called when no connection is available or the request failed.
	 *
	 */
	haveNoConnection: function() {
		enyo.application.spooler.nextAction();
	},

	/** @private
	 *
	 * Determine the type of the given feed.
	 *
	 * @param 	feed		{object}	feed object
	 * @param 	response	{object} 	AJAX response
	 * @param	request		{object}	AJAX request
	 * @return 				{boolean}	true if type is supported
	 */
	determineFeedType: function(feed, response, request) {
		try {
			if(request.xhr.responseText.length === 0) {
				if(this.changingFeed) {
					enyo.application.showError($L("The Feed '{$title}' does not return data."),
											   { title: feed.url });
				}
				this.log("FEEDS> Empty responseText in", feed.url);
				return enyo.application.db.setFeedType(feed, feedTypes.ftUnknown);
			}

			var feedType = response.getElementsByTagName("rss");
			if(feedType.length > 0) {
				return enyo.application.db.setFeedType(feed, feedTypes.ftRSS);
			} else {
				feedType = response.getElementsByTagName("RDF");
				if (feedType.length > 0) {
					return enyo.application.db.setFeedType(feed, feedTypes.ftRDF);
				} else {
					feedType = response.getElementsByTagName("feed");
					if (feedType.length > 0) {
						return enyo.application.db.setFeedType(feed, feedTypes.ftATOM);
					} else {
						if(this.changingFeed) {
							enyo.application.showError($L("The format of Feed '{$title}' is unsupported."), { title: feed.url });
						}
						this.log("FEEDS> Unsupported feed format in", feed.url);
						return enyo.application.db.setFeedType(feed, feedTypes.ftUnknown);
					}
				}
			}
		} catch(e) {
			this.error("FEEDS EXCEPTION>", e);
		}
		return enyo.application.db.setFeedType(feed.url, feedTypes.ftUnknown);
	},

	/** @private
	 *
	 * Parse RDF Feed data.
	 *
	 * @param 	feed		{object}	feed object
	 * @param 	response	{object} 	AJAX response
	 * @param	request		{object}	AJAX request
	 */
	parseAtom: function(feed, response, request) {
		try {
			var enclosures = {}, story = {};
			var url = "", enc = 0, type = "", title = "";
			var el = 0;
			var contentType = request.xhr.getResponseHeader("Content-Type");

			var atomItems = response.getElementsByTagName("entry");
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
						story.title = this.$.storyFormatter.stripBreaks(this.$.cpConverter.convert(contentType, unescape(atomItems[i].getElementsByTagName("title").item(0).textContent)));
					}

					if(atomItems[i].getElementsByTagName("content") &&
					   atomItems[i].getElementsByTagName("content").item(0)) {
						story.summary = this.$.storyFormatter.reformatSummary(this.$.cpConverter.convert(contentType, atomItems[i].getElementsByTagName("content").item(0).textContent));
					} else if (atomItems[i].getElementsByTagName("summary") &&
						atomItems[i].getElementsByTagName("summary").item(0)) {
						story.summary = this.$.storyFormatter.reformatSummary(this.$.cpConverter.convert(contentType, atomItems[i].getElementsByTagName("summary").item(0).textContent));
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
								if(url.match(/.*\.htm(l){0,1}/i) ||
								  (type && (type.match(/text\/html/i) || type.match(/application\/xhtml\+xml/i)))){
									title = enclosures.item(enc).getAttribute("title");
									if((title === null) || (title.length === 0)) {
										if(rel && rel.match(/alternate/i)) {
											title = $L("Weblink");
										} else if (rel && rel.match(/replies/i)) {
											title = $L("Replies");
										} else {
											title = $L("Weblink");
										}
									}
									story.url.push({
										title:	this.$.cpConverter.convert(contentType, title),
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
											  url.match(/.*\.m4a/i) ||
											  url.match(/.*\.aac/i)) {
										story.audio = url;
									} else if(url.match(/.*\.mpg/i) ||
											  url.match(/.*\.mpeg/i) ||
											  url.match(/.*\.m4v/i) ||
											  url.match(/.*\.avi/i) ||
											  (url.match(/.*\.mp4/i) && type.match(/video\/.*/i))) {
										story.video = url;
									}
								}
							}
						}
					}

					// Set the publishing date.
					if (atomItems[i].getElementsByTagName("updated") &&
						atomItems[i].getElementsByTagName("updated").item(0)) {
						story.pubdate = this.$.dateFormatter.dateToInt(atomItems[i].getElementsByTagName("updated").item(0).textContent,
																	   this.$.storyFormatter);
					}

					// Set the unique id.
					if (atomItems[i].getElementsByTagName("id") &&
						atomItems[i].getElementsByTagName("id").item(0)) {
						story.uuid = this.$.storyFormatter.stripBreaks(atomItems[i].getElementsByTagName("id").item(0).textContent);
					} else {
						story.uuid = this.$.storyFormatter.stripBreaks(story.title);
					}

					enyo.application.db.addOrEditStory(feed, story);
				} catch(e) {
					this.error("FEEDS EXCEPTION>", e);
				}
			}
		} catch(ex) {
			this.error("FEEDS EXCEPTION>", ex);
		}
	},

	/** @private
	 *
	 * Parse RSS Feed data.
	 *
	 * @param 	feed		{object}	feed object
	 * @param 	response	{object} 	AJAX response
	 * @param	request		{object}	AJAX request
	 */
	parseRSS: function(feed, response, request) {
		try {
			var enclosures = {}, story = {};
			var url = "", type = "", enc = 0;
			var el = 0;
			var contentType = request.xhr.getResponseHeader("Content-Type");

			var rssItems = response.getElementsByTagName("item");
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
						story.title = this.$.storyFormatter.stripBreaks(this.$.cpConverter.convert(contentType, unescape(rssItems[i].getElementsByTagName("title").item(0).textContent)));
					}
					if(rssItems[i].getElementsByTagName("description") &&
					   rssItems[i].getElementsByTagName("description").item(0)) {
						story.summary = this.$.storyFormatter.reformatSummary(this.$.cpConverter.convert(contentType, rssItems[i].getElementsByTagName("description").item(0).textContent));
					}
					if(rssItems[i].getElementsByTagName("link") &&
					   rssItems[i].getElementsByTagName("link").item(0)) {
						story.url.push({
							title:	"Weblink",
							href:	this.$.storyFormatter.stripBreaks(rssItems[i].getElementsByTagName("link").item(0).textContent)
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
					   story.pubdate = this.$.dateFormatter.dateToInt(rssItems[i].getElementsByTagName("pubDate").item(0).textContent,
																	  this.$.storyFormatter);
					} else if (rssItems[i].getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "date") &&
							   rssItems[i].getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "date").item(0)) {
						story.pubdate = this.$.dateFormatter.dateToInt(rssItems[i].getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "date").item(0).textContent,
																	   this.$.storyFormatter);
					} else {
						this.log("FEEDS> no pubdate given");
					}

					// Set the unique id.
					if(rssItems[i].getElementsByTagName("guid") &&
					   rssItems[i].getElementsByTagName("guid").item(0)) {
						story.uuid = this.$.storyFormatter.stripBreaks(rssItems[i].getElementsByTagName("guid").item(0).textContent);
					} else {
						story.uuid = this.$.storyFormatter.stripBreaks(story.title);
					}

					enyo.application.db.addOrEditStory(feed, story);
				} catch(e) {
					this.error("FEEDS EXCEPTION>", e);
				}
			}
		} catch(ex) {
			this.error("FEEDS EXCEPTION>", ex);
		}
	},

	/** @private
	 *
	 * Parse RDF Feed data.
	 *
	 * @param 	feed		{object}	feed object
	 * @param 	response	{object} 	AJAX response
	 * @param	request		{object}	AJAX request
	 */
	parseRDF: function(feed, response, request) {
		this.parseRSS(feed, response, request);		// Currently we do the same as for RSS.
	},

	/** @private
	 *
	 * Called when an Ajax request succeeds.
	 *
	 * @param	sender		{object}	sender
	 * @param 	response	{object} 	response object
	 * @param	request		{object}	request
	 */
	updateFeedSuccess: function(sender, response, request) {
		var feed = request.feed;
		this.log("FEEDS> Got new content from", feed.url);
		try {
			if(response === null) {
				if(request.xhr.responseText.length <= 0) {
					this.log("FEEDS> No response at all... maybe no connection available");
					enyo.application.db.endStoryUpdate(feed, false);
					enyo.application.spooler.nextAction();
					return;
				} else if(request.xhr.responseText !== null) {
					this.log("FEEDS> Manually converting feed info to xml for", feed.url);
					response = new DOMParser().parseFromString(request.xhr.responseText, "text/xml");
					this.log(request.xhr.responseText);
				}
			}

			var type = this.determineFeedType(feed, response, request);
			switch(type) {
				case feedTypes.ftRDF:
					this.parseRDF(feed, response, request);
					break;

				case feedTypes.ftRSS:
					this.parseRSS(feed, response, request);
					break;

				case feedTypes.ftATOM:
					this.parseAtom(feed, response, request);
					break;
			}
			enyo.application.db.endStoryUpdate(feed, type != feedTypes.ftUnknown);
		} catch(e) {
			this.error("FEEDS EXCEPTION>", e);
			enyo.application.db.endStoryUpdate(feed, false);
		}
		enyo.application.spooler.nextAction();
	},

	/** @private
	 *
	 * Called when an Ajax request fails.
	 *
	 * @param 	feed		{object}	feed object
	 * @param 	transport	{object} 	AJAX transport
	 */
	updateFeedFailed: function(sender, response, request) {
		var feed = request.feed;
		try {
			var error = "";
			switch(transport.xhr.status) {
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
					if (transport.xhr.status >= 500) {
						error = $L("Server error");
					} else {
						error = $L("Unexpected error");
					}
					break;
			}
			this.warn("FEEDS> Feed", feed.url, "is defect; error:", error);
			if (this.changingFeed) {
				enyo.application.db.disableFeed(feed);
				enyo.application.showError($L("The Feed '{$title}' could not be retrieved. The server responded: {$err}. The Feed was automatically disabled."),
										   { title: feed.url, err: error} );
			}
		} catch(e) {
			this.error("FEEDS EXCEPTION>", e);
		}
		enyo.application.db.endStoryUpdate(feed, false);	// Don't delete old storys.
		enyo.application.spooler.nextAction();
	},

	/** @private
	 *
	 * Get the count of new stories and post a notification.
	 */
	getNewCount: function() {
		enyo.application.db.getNewStoryCount(enyo.bind(this, this.postNotification));
	},

	/** @private
	 *
	 * Post a notification about new story count.
	 *
	 * @param	count	{integer}		count of new stories
	 */
	postNotification: function(count) {
		try {
			if(count > 0) {
				if((!enyo.application.isActive) && (!this.interactiveUpdate) && (enyo.application.prefs.notificationEnabled)) {
					this.log("FEEDS> About to post notification for new items; count =", count);
					enyo.application.launcher.openItemDashboard(count);
				}
			}
		} catch(e) {
			this.error("FEEDS EXCEPTION>", e);
		}
		enyo.application.spooler.nextAction();
	},

	/**
	 * Mark all stories of the given feed as being read.
	 *
	 * @param {Object}	feed		feed object
	 */
	markAllRead: function(feed) {
		enyo.application.db.markAllRead(feed, 1, function() {
			enyo.application.notifyFeedListChanged();
			enyo.application.notifyStoryListChanged();
		});
	},

	/**
	 * Mark a given story as being read.
	 *
	 * @param {Object} story	story object
	 */
	markStoryRead: function(story) {
		enyo.application.db.markStoryRead(story, function() {
			enyo.application.notifyFeedListChanged();
			enyo.application.notifyStoryListChanged();
		});
	},

	/**
	 * Mark all stories of the given feed as being unread.
	 *
	 * @param {Object} feed		feed object
	 */
	markAllUnRead: function(feed) {
		enyo.application.db.markAllRead(feed, 0, function() {
			enyo.application.notifyFeedListChanged();
			enyo.application.notifyStoryListChanged();
		});
	},

	/**
	 * Set a story's isStarred flag.
	 *
	 * @param	story	{Object}	story object
	 */
	markStarred: function(story) {
		enyo.application.db.markStarred(story, function() {
			enyo.application.notifyFeedListChanged();
			enyo.application.notifyStoryListChanged();
		});

		var storyMarker = function(feed, story, urls) {
			if(urls.length <= 0) {
				return;
			} else if(story.isStarred) {
				enyo.application.ril.addURL(story.title, urls[0].href);
			} else {
				enyo.application.ril.removeURL(urls[0].href);
			}
		};
		enyo.application.db.getStory(story.id, enyo.bind(this, storyMarker));
	},

	/**
	 * Remove the star state from all feeds of a given feed.
	 *
	 * @param	feed	{object}	feed object
	 */
	markAllUnStarred: function(feed) {
		var storyMarker = function(list) {
			if(list.length > 0) {
				enyo.application.ril.removeURLs(list);
			}
		};
		enyo.application.db.getFeedURLList(feed, storyMarker.bind(this));
		enyo.application.db.markAllUnStarred(feed, function() {
			enyo.application.notifyFeedListChanged();
			enyo.application.notifyStoryListChanged();
		});
	},

	/**
	 * Delete a given feed.
	 *
	 * @param 	feed	{object}		feed object
	 */
	deleteFeed: function(feed) {
		var onSuccess = function() {
			enyo.application.notifyFeedListChanged();
		};
		var onFail = function(transaction, error) {
			enyo.application.notifyFeedListChanged();
			this.error("FEEDS> Deleting feed failed:", error.message);
		};
		enyo.application.db.deleteFeed(feed, onSuccess, onFail);
	},

	/**
	 * Delete a given story.
	 *
	 * @param 	story	{object}		story object
	 */
	deleteStory: function(story) {
		var onSuccess = function() {
			enyo.application.notifyFeedListChanged();
			enyo.application.notifyStoryListChanged();
		};
		var onFail = function(transaction, error) {
			enyo.application.notifyStoryListChanged();
			enyo.error("FEEDS> Deleting story failed:", error.message);
		};
		enyo.application.db.deleteStory(story, onSuccess, onFail);
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

		var onSuccess = function() {
			enyo.application.notifyFeedListChanged();
		};

		enyo.application.db.reOrderFeed(fromIndex, toIndex, onSuccess);
	},

	/** @private
	 *
	 * Called when editing a feed succeeds.
	 *
	 * @param onSuccess	{function}	called on success
	 * @param	feed	{object}	feed object
	 */
	onAddOrEditFeedSuccess: function(onSuccess, feed) {
		enyo.application.notifyFeedListChanged({
			action:		"addOrEditFeed",
			feed:		feed
		});
		if(onSuccess) {
			onSuccess();
		}
		if(feed.enabled) {
			this.changingFeed = true;
			this.enqueueUpdate(feed);
		}
	},

	/**
	 * Add a new feed or edit an existing one.
	 *
	 * @param feed		{object} 	feed object
	 * @param onSuccess	{function}	called on success
	 * @param onFail	{function}	called on failure
	 */
	addOrEditFeed: function(feed, onSuccess, onFail) {
		if(feed.title === "") {
			feed.title = "RSS Feed";
		}
		enyo.application.db.addOrEditFeed(feed, enyo.bind(this, this.onAddOrEditFeedSuccess, onSuccess), onFail);
	},

	/**
	 * Get the effective title of a feed.
	 *
	 * @param		feed		{object} 	feed object
	 * @returns					{string}	title
	 */
	getFeedTitle: function(feed) {
		switch(feed.feedType) {
			case feedTypes.ftStarred:	return $L("Starred items");
			case feedTypes.ftAllItems:	return $L("All items");
		}
		return feed.title;
	},

	/**
	 * Get the effective url of a feed.
	 *
	 * @param		feed		{object} 	feed object
	 * @returns					{string}	url
	 */
	getFeedURL: function(feed) {
		switch(feed.feedType) {
			case feedTypes.ftStarred:	return $L("All starred items");
			case feedTypes.ftAllItems:	return $L("Aggregation of all items");
		}
		return feed.url;
	},

	/**
	 * Return a feeds icon.
	 *
	 * @param	feed	{Object} 	a feed object
	 * @return			{String}	the header icon
	 */
	getFeedIcon: function(feed, ignoreEnabled, ignoreUnknown) {
		var prefix = "images/lists/icon-";
		var icon = "";
		var suffix = "";
		if(enyo.application.scrimMode) {
			icon = "starred"
		} else {
			switch(feed.feedType) {
				case feedTypes.ftAllItems:	icon = "allitems";	break;
				case feedTypes.ftStarred:	icon = "starred";	break;
				case feedTypes.ftRDF:
				case feedTypes.ftRSS:		icon = "rss";		break;
				case feedTypes.ftATOM:		icon = "atom";		break;
				default:					icon = ignoreUnknown ? "rss" : "unknown"; break;
			}
			if(!ignoreEnabled && !feed.enabled) {
				suffix = 'disabled';
			}
		}
		return prefix + icon + suffix + '.png';
	},

	getFeeds: function(filter, offset, count, onSuccess) {
		enyo.application.db.getFeeds(filter, offset, count, onSuccess);
	},

	getFeed: function(id, onSuccess) {
		enyo.application.db.getFeed(id, onSuccess);
	},

	getFeedURLList: function(feed, onSuccess) {
		enyo.application.db.getFeedURLList(feed, onSuccess);
	},

	getFeedIDList: function(onSuccess) {
		enyo.application.db.getFeedIDList(onSuccess);
	},

	getFeedCount: function(filter, onSuccess) {
		enyo.application.db.getFeedCount(filter, onSuccess);
	},

	getStories: function(feed, filter, offset, count, onSuccess) {
		enyo.application.db.getStories(feed, filter, offset, count, onSuccess);
	},

	getStoryCount: function(feed, filter, onSuccess) {
		enyo.application.db.getStoryCount(feed, filter, onSuccess);
	},

	getStoryIDList: function(feed, onSuccess) {
		enyo.application.db.getStoryIDList(feed, onSuccess);
	},

	getStory: function(id, onSuccess) {
		enyo.application.db.getStory(id, onSuccess);
	},

	/**
	 * Set the sort mode of a feed.
	 *
	 * @param		feed		{object} 	feed object
	 */
	setSortMode: function(feed) {
		enyo.application.db.setSortMode(feed, function() {
			enyo.log("FEEDS> feedOrder", feed.feedOrder);
			enyo.application.notifyStoryListChanged();
		});
	},

	/**
	 * Returns true, if initialization is complete.
	 *
	 * @returns		{bool}	readyness state
	 */
	isReady: function() {
		return (enyo.application.db.ready && (!enyo.application.db.loading));
	},

	/**
	 * Returns true, if an update is in progress.
	 *
	 * @returns		{bool}		update state
	 */
	isUpdating: function() {
		return enyo.application.spooler.hasWork();
	},

	/**
	 * Return a single pseudo-feed used for the main scrim.
	 *
	 * @returns		{array}		array containing pseudo-feed
	 */
	getCopyrightFeed: function() {
		var list = [];

		list.push(new Feed({
			title:		enyo.application.appName,
			url:		"© " + enyo.application.copyrightYears + " " + enyo.application.appAuthor,
			feedType:	feedTypes.ftRSS,
			feedOrder:	0,
			enabled:	true
		}));
		return list;
	}
});
