/*
 *		app/models/database.js - Database functions
 *
 * The classes defined here communicate with the FeedReader SQLite
 * database. It does not contain the migration code used to migrate
 * the older Depot-based database into the current structure.
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

/**
 * This enumeration contains all feed types used by FeedReader.
 * To check for a non-special feed, check the feedType member of
 * a feed object if it is lower than feedTypes.ftUnknown.
 */
var feedTypes = {
	ftStarred:	-3,
	ftAllItems:	-2,
	ftUnknown:	-1,
	ftRDF:		1,
	ftRSS:		2,
	ftATOM:		3
};

/** @private
 *
 * Common SQL statements.
 */
var commonSQL = {
	csGetFeedIDByURL:	"SELECT id FROM feeds WHERE url = ?",
	csGetFeedData:		"SELECT COALESCE(SUM(isNew), 0) AS numNew, COALESCE((COUNT(uuid) - SUM(isRead)), 0) AS numUnRead, feeds.*" +
						"  FROM feeds" +
						"  LEFT JOIN stories" +
						"    ON (stories.fid = feeds.id) OR (feeds.feedType = ? AND stories.isStarred = 1) OR (feeds.feedType = ?) ",
	csGetStoryIDs:		"SELECT id" +
						"  FROM stories"
};

/**
 * This class is the main database class. All database communication
 * is centralized here.
 * The feed list class encapsulated an object of this class.
 */
var database = Class.create({
	db:					null,
	nullDataHandler:	null,
	errorHandler:		null,
	migrateFromDepot:	false,
	migrator:			null,
	transactionCounter:	0,
	ready:				true,
	loading:			true,
	
	/** @private
	 * 
	 * Constructor.
	 */
	initialize: function() {
		// Transaction handlers.
		this.transactionSuccessHandler = this.transactionSuccess.bind(this);
		this.transactionFailedHandler = this.transactionFailed.bind(this);
		
		// Per-Query handlers.
		this.nullDataHandler = this.nullData.bind(this);
		this.errorHandler = this.error.bind(this);
		
		try {
			this.db = openDatabase("ext:FeedReader", "", "FeedReader Database");
			
			var checkVersionHandler = this.checkVersion.bind(this);
			var initDBHandler = this.initDB.bind(this);
			this.transaction(function(transaction) {
				transaction.executeSql("SELECT MAX(version) AS version FROM system",
									   [], checkVersionHandler, initDBHandler);
			});
		} catch(e) {
			Mojo.Log.logException(e, "DB");
		}
	},
	
	/** @private
	 * 
	 * Open a transaction.
	 *
	 * @param	fnc			{function}		function to be called with opened transaction
	 */
	transaction: function(fnc) {
		this.transactionCounter++;
		this.db.transaction(fnc,
							this.transactionFailedHandler,
							this.transactionSuccessHandler);
	},
	
	/** @private
	 * 
	 * Event handler for failed transactions.
	 *
	 * @param	error		{Object}		error object
	 */
	transactionFailed: function(error) {
		Mojo.Log.error("DB> Transaction failed; error code:", error.code, "; message:", error.message);
		this.transactionCounter--;
		this.handleLoad();
	},
	
	/** @private
	 * 
	 * Event handler for successful transactions.
	 */
	transactionSuccess: function() {
		this.transactionCounter--;
		this.handleLoad();
	},
	
	/** @private
	 * 
	 * Used when migrating Depot database to send a success notification.
	 */
	handleLoad: function() {
		if(!this.ready && (this.transactionCounter <= 0)) {
			this.ready = true;
			this.loading = false;
			Mojo.Controller.getAppController().sendToNotificationChain({ type: "feedlist-loaded" });
			if(this.migrator) {
				delete this.migrator;
			}
			if(FeedReader.prefs.updateOnStart) {
				FeedReader.feeds.enqueueUpdateAll();
			}
		}
	},
	
	/** @private
	 * 
	 * Called when opening the database succeeds.
	 */
	dbReady: function() {
		Mojo.Log.info("DB> Database schema ready");
			
		if(this.migrateFromDepot) {
			// At first, check the properties cookie.
			var props = new Mojo.Model.Cookie("comtegi-stuffAppFeedReaderProps");
			var data = props.get();
			props.remove();	// Delete the cookie.
			var ver = data ? data.version : 1;
			
			if(ver == 1) {
				// If the properties cookie does not exist, check if the prefs
				// cookie exists. If not, FeedReader has not been used before.
				var prefs = new Mojo.Model.Cookie("comtegi-stuffAppFeedReaderPrefs");
				var settings = prefs.get();
				if(!settings || !settings.version) {
					ver = 0;
				}
			}
			
			if(ver > 0) {
				Mojo.Log.info("DB> Migrating from depot, version", ver);
				this.ready = false;
				this.migrator = new migrator(this, ver);
			} else {
				Mojo.Log.info("DB> No need to migrate; new installation");
				this.loading = false;
			}
		} else {
			Mojo.Log.info("DB> No migration needed");
			this.loading = false;
		}
		if(this.ready && !this.loading) {
			Mojo.Controller.getAppController().sendToNotificationChain({ type: "feedlist-loaded" });
			if(FeedReader.prefs.updateOnStart || FeedReader.feeds.updateWhenReady) {
				FeedReader.feeds.updateWhenReady = false;
				FeedReader.feeds.enqueueUpdateAll();
			}
		}
	},
	
	/** @private
	 *
	 * Create the database schema.
	 *
	 * @param	transaction	{Object}		transaction object
	 */
	initDB: function(transaction) {
		try {
			this.migrateFromDepot = true;
			Mojo.Log.info("DB> initializing database");
			
			// Create the feed table.
			transaction.executeSql('CREATE TABLE feeds (' +
								   '  id INTEGER PRIMARY KEY,' +
								   '  title TEXT DEFAULT "RSS Feed",' +
								   '  url TEXT NOT NULL,' +
								   '  feedType INTEGER NOT NULL,' +
								   '  feedOrder INTEGER NOT NULL,' +
								   '  enabled BOOL NOT NULL,' +
								   '  showPicture BOOL NOT NULL,' +
								   '  showMedia BOOL NOT NULL,' +
								   '  showListSummary BOOL NOT NULL,' +
								   '  showListCaption BOOL NOT NULL,' +
								   '  showDetailSummary BOOL NOT NULL,' +
								   '  showDetailCaption BOOL NOT NULL,' +
								   '  sortMode INTEGER NOT NULL,' +
								   '  allowHTML BOOL NOT NULL)',
								   [], this.nullDataHandler, this.errorHandler);
			transaction.executeSql('CREATE UNIQUE INDEX idx_feeds_title' +
								   '  ON feeds (title COLLATE RTRIM)',
								   [], this.nullDataHandler, this.errorHandler);
			transaction.executeSql('CREATE UNIQUE INDEX idx_feeds_url' +
								   '  ON feeds (url COLLATE RTRIM)',
								   [], this.nullDataHandler, this.errorHandler);

			// Create the story table.
			transaction.executeSql('CREATE TABLE stories (' +
								   '  id INTEGER PRIMARY KEY,' +
								   '  fid INT NOT NULL CONSTRAINT fk_stories_fid' +
								   '    REFERENCES feeds(id)' +
								   '    ON DELETE CASCADE ON UPDATE CASCADE MATCH SIMPLE DEFERRABLE,' +
								   '  uuid TEXT,' +
								   '  title TEXT,' +
								   '  summary TEXT,' +
								   '  picture TEXT,' +
								   '  audio TEXT,' +
								   '  video TEXT,' +
								   '  isRead BOOL NOT NULL DEFAULT 0,' +
								   '  isNew BOOL NOT NULL DEFAULT 1,' +
								   '  isStarred BOOL NOT NULL DEFAULT 0,' +
								   '  pubdate INT NOT NULL,' +
								   '  flag BOOL NOT NULL DEFAULT 0)',
								   [], this.nullDataHandler, this.errorHandler);
			transaction.executeSql('CREATE UNIQUE INDEX idx_stories_fid_uuid' +
								   '  ON stories (fid, uuid)',
								   [], this.nullDataHandler, this.errorHandler);
			
			// The storyurls table takes up the urls.
			transaction.executeSql('CREATE TABLE storyurls (' +
								   '  id INTEGER PRIMARY KEY,' +
								   '  sid INT NOT NULL CONSTRAINT fk_storyurls_sid' +
								   '    REFERENCES stories(id)' +
								   '    ON DELETE CASCADE ON UPDATE CASCADE MATCH SIMPLE DEFERRABLE,' +
								   '  title TEXT,' +
								   '  href TEXT)',
								   [], this.nullDataHandler, this.errorHandler);
			
			// Create the system table. It currently contains nothing but the version.
			transaction.executeSql('CREATE TABLE system (version INTEGER)',
								   [], this.nullDataHandler, this.errorHandler);
			transaction.executeSql('INSERT INTO system (version) VALUES(10)',
								   [], this.nullDataHandler, this.errorHandler);

			// Insert aggregated feeds with default settings.
			transaction.executeSql('INSERT INTO feeds (title, url, feedType, feedOrder, enabled, showPicture,' +
								   '                   showMedia, showListSummary, showListCaption,'+
								   '                   showDetailSummary, showDetailCaption, sortMode, allowHTML)' +
								   '  VALUES(?, "starred", ?, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1)',
								   ['Starred Items', feedTypes.ftStarred],
								   this.nullDataHandler, this.errorHandler);
			transaction.executeSql('INSERT INTO feeds (title, url, feedType, feedOrder, enabled, showPicture,' +
								   '                   showMedia, showListSummary, showListCaption,'+
								   '                   showDetailSummary, showDetailCaption, sortMode, allowHTML)' +
								   '  VALUES(?, "allItems", ?, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1)',
								   [feedTypes.ftAllItems, 'All Items'],
								   this.nullDataHandler, this.errorHandler);
			this.dbReady();
		} catch(e) {
			Mojo.Log.logException(e, "DB");
		}
	},
	
	/** @private
	 *
	 * Check the database version and upgrade if necessary.
	 *
	 * @param	transaction		{Object}	transaction object
	 * @param	result			{Object}	database result object
	 */
	checkVersion: function(transaction, result) {
		var version = result.rows.item(0).version;
		Mojo.Log.info("DB> Database already exists, version is:", version);			
		this.dbReady();
	},
	
	/** @private
	 *
	 * Default data handler. Does nothing.
	 *
	 * @param	transaction	{Object}		transaction object
	 * @param	result		{Object}		database result object
	 */
	nullData: function(transaction, result) {
	},
	
	/** @private
	 *
	 * Default error handler.
	 *
	 * @param	transaction	{Object}		transaction object
	 * @param	error		{Object}		error object
	 */
	error: function(transaction, error) {
		Mojo.Log.error("DB>", error.message);
	},
	
	/**
	 * Add a feed or edit a feed's properties.
	 *
	 * @param	feed		{Object}		feed object
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */
	addOrEditFeed: function(feed, onSuccess, onFail) {
		onSuccess = onSuccess || this.nullDataHandler;
		onFail = onFail || this.errorHandler;
		
		var feedOrder = feed.feedOrder || "(SELECT MAX(feedOrder) + 1 FROM feeds)";
		
		this.transaction(function(transaction) {
			transaction.executeSql('INSERT OR REPLACE INTO feeds (title, url, feedType, feedOrder, enabled, showPicture,' +
								   '                              showMedia, showListSummary, showListCaption,'+
								   '                              showDetailSummary, showDetailCaption, sortMode, allowHTML)' +
								   '  VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
								   [feed.title, feed.url, feed.feedType, feedOrder,
									feed.enabled ? 1 : 0,
									feed.showPicture ? 1 : 0, feed.showMedia ? 1 : 0,
									feed.showListSummary ? 1 : 0, feed.showListCaption ? 1 : 0,
									feed.showDetailSummary ? 1 : 0, feed.showDetailCaption ? 1 : 0,
									feed.sortMode, feed.allowHTML ? 1 : 0],
									onSuccess, onFail);
		});
	},
	
	/**
	 * Set the type of a feed.
	 *
	 * @param	url			{String}		url of the feed to change
	 * @param	type		{int}			type of the feed
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */
	setFeedType: function(url, type, onSuccess, onFail) {
		onSuccess = onSuccess || this.nullDataHandler;
		onFail = onFail || this.errorHandler;
		
		this.transaction(function(transaction) {
			transaction.executeSql("UPDATE feeds SET feedType = ? WHERE url = ?",
								   [type, url], onSuccess, onFail);
		});
		return type;
	},
	
	/**
	 * Set the sort mode of a feed.
	 *
	 * @param	feed		{object}		feed object
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */
	setSortMode: function(feed, onSuccess, onFail) {
		onSuccess = onSuccess || this.nullDataHandler;
		onFail = onFail || this.errorHandler;
		
		this.transaction(function(transaction) {
			transaction.executeSql("UPDATE feeds SET sortMode = ? WHERE id = ?",
								   [feed.sortMode, feed.id], onSuccess, onFail);
		});
	},
	
	/**
	 * Disable a feed.
	 *
	 * @param	url			{String}		url of the feed to disable
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */
	disableFeed: function(url, onSuccess, onFail) {
		onSuccess = onSuccess || this.nullDataHandler;
		onFail = onFail || this.errorHandler;
		
		this.transaction(function(transaction) {
			transaction.executeSql("UPDATE feeds SET feedType = ?, enabled = 0 WHERE url = ?",
								   [feedTypes.ftUnknown, url], onSuccess, onFail);
		});		
	},
	
	/**
	 * Delete a feed.
	 *
	 * @param	id			{int}			ID of the feed to delete
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */
	deleteFeed: function(id, onSuccess, onFail) {
		onSuccess = onSuccess || this.nullDataHandler;
		onFail = onFail || this.errorHandler;
		
		this.transaction(function(transaction) {
			transaction.executeSql("DELETE FROM feeds WHERE ID = ?",
								   [id], onSuccess, onFail);
		});
	},
	
	/**
	 * Change the order of a feed.
	 *
	 * @param	oldOrder	{int}			old order of the feed
	 * @param	newOrder	{int}			new order of the feed
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */
	reOrderFeed: function(oldOrder, newOrder, onSuccess, onFail) {
		onSuccess = onSuccess || this.nullDataHandler;
		onFail = onFail || this.errorHandler;
		
		var count = 0;
		var successWrapper = function() {
			if(++count > 3) {
				Mojo.Log.info("DB> Feed order successfully changed from", oldOrder, "to", newOrder);
				onSuccess();
			}
		};
		
		this.transaction(function(transaction) {
			transaction.executeSql("UPDATE feeds SET feedOrder = -1 WHERE feedOrder = ?",
								   [oldOrder], successWrapper, onFail);
			transaction.executeSql("UPDATE feeds SET feedOrder = feedOrder - 1 WHERE feedOrder > ?",
								   [oldOrder], successWrapper, onFail);
			transaction.executeSql("UPDATE feeds SET feedOrder = feedOrder + 1 WHERE feedOrder >= ?",
								   [newOrder], successWrapper, onFail);
			transaction.executeSql("UPDATE feeds SET feedOrder = ? WHERE feedOrder = -1",
								   [newOrder], successWrapper, onFail);
		});
	},

	/**
	 * Retrieve a list of updatable feeds.
	 *
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */
	getUpdatableFeeds: function(onSuccess, onFail) {
		Mojo.assert(onSuccess, "DB> getUpdatableFeeds needs data handler");		
		onFail = onFail || this.errorHandler;
		
		this.transaction(function(transaction) {
			transaction.executeSql("SELECT url FROM feeds WHERE feedType > 0 AND enabled = 1", [],
				function(transaction, result) {
					var list = [];
					for(var i = 0; i < result.rows.length; i++) {
						list.push(result.rows.item(i).url);
					}
					onSuccess(list);
				}, onFail);
		});
	},
	
	/**
	 * Get the count of feeds matching a filter string.
	 *
	 * @param	filter		{String}		filter string
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */
	getFeedCount: function(filter, onSuccess, onFail) {
		Mojo.assert(onSuccess, "DB> getFeedCount needs data handler");		
		onFail = onFail || this.errorHandler;
		
		this.transaction(
			function(transaction) {
				transaction.executeSql("SELECT COUNT(id) AS feedcount" +
									   "  FROM feeds" +
									   "  WHERE title LIKE '%' || ? || '%'", [filter],
					function(transaction, result) {
						onSuccess(result.rows.item(0).feedcount);
					}, onFail);
			});
	},
	
	/**
	 * Retrieve a list of feeds.
	 *
	 * @param	filter		{String}		filter string
	 * @param	offset		{int}			first feed to return
	 * @param	count		{int}			count of feeds to return
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */
	getFeeds: function(filter, offset, count, onSuccess, onFail) {
		Mojo.assert(onSuccess, "DB> getFeeds needs data handler");		
		onFail = onFail || this.errorHandler;
		this.transaction(
			function(transaction) {
				transaction.executeSql(commonSQL.csGetFeedData +
									   "  WHERE feeds.title LIKE '%' || ? || '%'" +
									   "  GROUP BY feeds.id" +
									   "  ORDER BY feedOrder" +
									   "  LIMIT ? OFFSET ?",
					[feedTypes.ftStarred, feedTypes.ftAllItems, filter, count, offset],
					function(transaction, result) {
						var list = [];
						for(var i = 0; i < result.rows.length; i++) {
							list.push(result.rows.item(i));
						}
						onSuccess(offset, list);
					}, onFail);
			});
	},
	
	/**
	 * Get a list of all feed IDs.
	 *
	 * @param	onSuccess	{function}		called on success
	 * @param	onFail		{function}		called on failure
	 */
	getFeedIDList: function(onSuccess, onFail) {
		Mojo.assert(onSuccess, "DB> getFeedIDList needs data handler");
		onFail = onFail || this.errorHandler;
		
		// This function will assemble the result set.
		var handleResult = function(transaction, result) {
			var list = [];
			for(var i = 0; i < result.rows.length; i++) {
				list.push(result.rows.item(i).id);
			}
			onSuccess(list);
		};
		
		this.transaction(function(transaction) {
			transaction.executeSql("SELECT id FROM feeds ORDER BY feedOrder", [],
								   handleResult, onFail);
		});
	},
	
	/**
	 * Retrieve a feed.
	 *
	 * @param	id			{Integer}		feed id
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */
	getFeed: function(id, onSuccess, onFail) {
		Mojo.assert(onSuccess, "DB> getFeed needs data handler");
		onFail = onFail || this.errorHandler;
		this.transaction(
			function(transaction) {
				transaction.executeSql(commonSQL.csGetFeedData +
									   "  WHERE feeds.id = ?",
					[feedTypes.ftStarred, feedTypes.ftAllItems, id],
					function(transaction, result) {
						if(result.rows.length > 0) {
							onSuccess(result.rows.item(0));
						}
					}, onFail);
			});
	},

	/**
	 * Get the count of story matching a filter string.
	 *
	 * @param	feed		{Object}		feed object
	 * @param	filter		{String}		filter string
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */
	getStoryCount: function(feed, filter, onSuccess, onFail) {
		Mojo.assert(onSuccess, "DB> getStoryCount needs data handler");
		onFail = onFail || this.errorHandler;
			
		// This function will assemble the result set.
		var handleResult = function(transaction, result) {
			var count = 0;
			if(result.rows.length > 0) {
				count = result.rows.item(0).storyCount;
			}
			onSuccess(count);
		};
		
		// Build the SELECT statement.
		var selectStmt = "SELECT COUNT(id) AS storyCount" +
						 "  FROM stories" +
						 "  WHERE (title LIKE '%' || ? || '%')";
		switch(feed.sortMode & 0xFF) {
			case 1:	selectStmt += " AND isRead = 0";	break;
			case 2: selectStmt += " AND isNew = 1";	break;
		}
		
		switch(feed.feedType) {
			case feedTypes.ftAllItems:
				this.transaction(function(transaction) {
					transaction.executeSql(selectStmt, [filter], handleResult, onFail);
				});
				break;
			
			case feedTypes.ftStarred:
				this.transaction(function(transaction) {
					transaction.executeSql(selectStmt + " AND isStarred = 1",
										   [filter], handleResult, onFail);
				});
				break;
			
			default:
				this.transaction(function(transaction) {
					transaction.executeSql(selectStmt + " AND fid = ?",
										   [filter, feed.id],
										   handleResult, onFail);
				});
				break;
		}
	},
	
	/**
	 * Retrieve a list of stories matching a filter string.
	 *
	 * @param	feed		{Object}		feed object
	 * @param	filter		{String}		filter string
	 * @param	offset		{int}			first story to return
	 * @param	count		{int}			count of stories to return
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */
	getStories: function(feed, filter, offset, limit, onSuccess, onFail) {
		Mojo.assert(onSuccess, "DB> getStories needs data handler");
		onFail = onFail || this.errorHandler;
		
		// This function will assemble the result set.
		var handleResult = function(transaction, result) {
			var list = [];
			for(var i = 0; i < result.rows.length; i++) {
				list.push(result.rows.item(i));
			}
			onSuccess(offset, list);
		};

		// Build the basic SELECT statement.
		var selectStmt = "SELECT s.id, s.title, s.summary," +
						 "       s.pubdate, s.isRead, s.isNew, s.isStarred," +
						 "       f.title AS feedTitle, f.showListCaption AS showCaption," +
						 "       f.showListSummary AS showSummary" +
						 "  FROM stories AS s" +
						 "  INNER JOIN feeds AS f ON (f.id = s.fid)" +
						 "  WHERE (s.title LIKE '%' || ? || '%')";		
		switch(feed.sortMode & 0xFF) {
			case 1:	selectStmt += " AND s.isRead = 0";	break;
			case 2: selectStmt += " AND s.isNew = 1";	break;
		}
		
		// Build the ORDER clause.
		var orderAndLimit = " ORDER BY ";
		if((feed.sortMode & 0xFF00) != 0x0100) {
			orderAndLimit += "f.feedOrder, ";
		}
		orderAndLimit += "s.pubdate DESC LIMIT ? OFFSET ?";
		
		switch(feed.feedType) {
			case feedTypes.ftAllItems:
				this.transaction(function(transaction) {
					transaction.executeSql(selectStmt + orderAndLimit,
										   [filter, limit, offset],
										   handleResult, onFail);
				});
				break;
			
			case feedTypes.ftStarred:
				this.transaction(function(transaction) {
					transaction.executeSql(selectStmt + " AND s.isStarred = 1" + orderAndLimit,
										   [filter, limit, offset], handleResult, onFail);
				});
				break;
			
			default:
				this.transaction(function(transaction) {
					transaction.executeSql(selectStmt + " AND s.fid = ?" + orderAndLimit,
										   [filter, feed.id, limit, offset],
										   handleResult, onFail);
				});
				break;
		}
	},
	
	/**
	 * Retrieve a list of story IDs.
	 *
	 * @param	feed		{Object}		feed object
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */
	getStoryIDList: function(feed, onSuccess, onFail) {
		Mojo.assert(onSuccess, "DB> getStoryIDList needs data handler");
		onFail = onFail || this.errorHandler;
		
		// This function will assemble the result set.
		var handleResult = function(transaction, result) {
			var list = [];
			for(var i = 0; i < result.rows.length; i++) {
				list.push(result.rows.item(i).id);
			}
			onSuccess(list);
		};

		// Build the basic SELECT statement.
		var selectStmt = "SELECT s.id" +
						 "  FROM stories AS s" +
						 "  INNER JOIN feeds AS f ON (f.id = s.fid)";
		
		var whereClauseAddOn = null;
		switch(feed.sortMode & 0xFF) {
			case 1:	whereClauseAddOn = " s.isRead = 0";	break;
			case 2: whereClauseAddOn = " s.isNew = 1";	break;
		}
		
		// Build the ORDER clause.
		var orderAndLimit = " ORDER BY ";
		if((feed.sortMode & 0xFF00) != 0x0100) {
			orderAndLimit += "f.feedOrder, ";
		}
		orderAndLimit += "s.pubdate DESC";
		
		switch(feed.feedType) {
			case feedTypes.ftAllItems:
				this.transaction(function(transaction) {
					transaction.executeSql(selectStmt +
										   (whereClauseAddOn ? " WHERE" + whereClauseAddOn : "") +
										   orderAndLimit, [],
										   handleResult, onFail);
				});
				break;
			
			case feedTypes.ftStarred:
				this.transaction(function(transaction) {
					transaction.executeSql(selectStmt + " WHERE s.isStarred = 1" +
										   (whereClauseAddOn ? " AND" + whereClauseAddOn : "") +
										   orderAndLimit,
										   [], handleResult, onFail);
				});
				break;
			
			default:
				this.transaction(function(transaction) {
					transaction.executeSql(selectStmt + " WHERE s.fid = ?" +
										   (whereClauseAddOn ? " AND" + whereClauseAddOn : "") +
										   orderAndLimit, [feed.id],
										   handleResult, onFail);
				});
				break;
		}
	},
	
	/**
	 * Retrieve a story.
	 *
	 * @param	story		{Integer}		story id
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */
	getStory: function(id, onSuccess, onFail) {
		Mojo.assert(onSuccess, "DB> getStory needs data handler");
		onFail = onFail || this.errorHandler;
		
		var urls = [];
		var feed = null;
		var story = null;
		
		var getURLs = function(transaction) {
			transaction.executeSql("SELECT title, href" +
								   "  FROM storyurls" +
								   "  WHERE sid = ?",
								   [id],
				function(transaction, result) {
					if(result.rows.length > 0) {
						for(var i = 0; i < result.rows.length; i++) {
							urls.push({
								title:	result.rows.item(i).title,
								href:	result.rows.item(i).href
							});
						}
						onSuccess(feed, story, urls);
					}
				}, onFail);
		};
		
		var getFeedData = function(transaction) {
			transaction.executeSql("SELECT *" +
								   "  FROM feeds" +
								   "  WHERE id = (" +
								   "    SELECT fid FROM stories WHERE id = ?)",
								   [id],
				function(transaction, result) {
					if(result.rows.length > 0) {
						feed = result.rows.item(0);
						getURLs(transaction);
					}
				}, onFail);
		};
		
		this.transaction(function(transaction) {
			transaction.executeSql("SELECT * FROM stories WHERE id = ?",
				[id],
				function(transaction, result) {
					if(result.rows.length > 0) {
						story = result.rows.item(0);
						getFeedData(transaction);
					}
				}, onFail);
		});
	},
	
	/**
	 * Called to indicate a beginning update.
	 *
	 * @param	url			{String}		url of the feed
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */
	beginStoryUpdate: function(url, onSuccess, onFail) {
		onSuccess = onSuccess || this.nullDataHandler;
		onFail = onFail || this.errorHandler;
		var nullData = this.nullDataHandler;
		var onNotify = this.notifyOfUpdate.bind(this, true);
		
		var date = new Date();
		var newthreshold = date.getTime() - (24 * 60 * 60 * 1000);
		
		this.transaction(function(transaction) {
			transaction.executeSql("UPDATE stories" +
								   "  SET isNew = 0" +
								   "  WHERE (isRead = 1" +
								   "    OR pubdate < ?)" +
								   "    AND fid = (" + commonSQL.csGetFeedIDByURL + ')',
								   [newthreshold, url],
								   nullData, onFail);
			transaction.executeSql("UPDATE stories" +
								   "  SET flag = 1" +
								   "  WHERE isStarred = 0"+
								   "    AND fid = (" + commonSQL.csGetFeedIDByURL + ')',
								   [url], onSuccess, onFail);
			transaction.executeSql("SELECT feedOrder FROM feeds WHERE url = ?",
								   [url], onNotify, onFail);
		});
	},
	
	/**
	 * Send a notification of the update state of a feed.
	 *
	 * @param	state		{bool}			update state of the feed
	 * @param	transaction	{Object}		transaction object
	 * @param	result		{Object}		data
	 */
	notifyOfUpdate: function(state, transaction, result) {
		if(result.rows.length > 0) {
			Mojo.Controller.getAppController().sendToNotificationChain({
				type: 		"feed-update",
				inProgress: state,
				feedOrder:	result.rows.item(0).feedOrder
			});
		}
	},
	
	/**
	 * Called to indicate a finished update.
	 *
	 * @param	url			{String}		url of the feed
	 * @param	successful	{bool}			update was successful?
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */
	endStoryUpdate: function(url, successful, onSuccess, onFail) {
		onSuccess = onSuccess || this.nullDataHandler;
		onFail = onFail || this.errorHandler;
		var onNotify = this.notifyOfUpdate.bind(this, false);
		
		this.transaction(function(transaction) {
			if(successful) {
				transaction.executeSql("DELETE FROM stories" +
									   "  WHERE flag = 1" +
									   '    AND fid = (' + commonSQL.csGetFeedIDByURL + ')',
									   [url], onSuccess, onFail);
			} else {
				transaction.executeSql("UPDATE stories" +
									   "  SET flag = 0" +
									   "  WHERE fid = (" + commonSQL.csGetFeedIDByURL + ')',
									   [url], onSuccess, onFail);				
			}
			transaction.executeSql("SELECT feedOrder FROM feeds WHERE url = ?",
								   [url], onNotify, onFail);
		});
	},
	
	addOrEditStory: function(url, story, onSuccess, onFail) {
		onSuccess = onSuccess || this.nullDataHandler;
		onFail = onFail || this.errorHandler;
		
		var insertURLs = function(transaction, result) {
			var sid = result.insertId;
			for(var i = 0; i < story.url.length; i++) {
				transaction.executeSql("INSERT INTO storyurls (sid, title, href)" +
									   "  VALUES(?, ?, ?)",
									   [sid, story.url[i].title, story.url[i].href],
										this.nullDataHandler, this.errorHandler);
			}
			onSuccess();
		};
		
		this.transaction(
			function(transaction) {
				transaction.executeSql("SELECT id" +
									   "  FROM stories" +
									   "  WHERE fid = (" + commonSQL.csGetFeedIDByURL + ")" +
									   "    AND uuid = ?",
									   [url, story.uuid],
					function(transaction, result) {
						if(result.rows.length > 0) {
							var sid = result.rows.item(0).id;
							transaction.executeSql("UPDATE stories" +
												   "  SET title = ?," +
												   "    summary = ?," +
												   "    picture = ?," +
												   "    audio = ?," +
												   "    video = ?," +
												   "    pubdate = ?," +
												   "    flag = 0" +
												   "  WHERE id = ?",
												   [story.title, story.summary,
													story.picture, story.audio,
													story.video, story.pubdate,
													sid],
												   onSuccess, onFail);
							transaction.executeSql("DELETE FROM storyurls WHERE sid = ?", [sid],
												   this.nullDataHandler, this.errorHandler);
							insertURLs(transaction, { insertId: sid });
						} else {
							transaction.executeSql("INSERT INTO stories" +
												   "  (fid, uuid, title, summary, picture, audio, video, pubdate, isRead, isNew, isStarred, flag)" +
												   "  VALUES((" + commonSQL.csGetFeedIDByURL + "), ?, ?, ?, ?, ?, ?, ?, 0, 1, 0, 0)",
												   [url, story.uuid, story.title, story.summary, story.picture,
													story.audio, story.video, story.pubdate],
												   insertURLs, onFail);
						}
					},
					onFail);
			});
	},
	
	markStarred: function(story, onSuccess, onFail) {
		onSuccess = onSuccess || this.nullDataHandler;
		onFail = onFail || this.errorHandler;
		this.transaction(function(transaction) {
			transaction.executeSql("UPDATE stories SET isStarred = ? WHERE id = ?",
								   [story.isStarred ? 1 : 0, story.id], onSuccess, onFail);
		});
	},
	
	markStoryRead: function(story, onSuccess, onFail) {
		onSuccess = onSuccess || this.nullDataHandler;
		onFail = onFail || this.errorHandler;
		this.transaction(function(transaction) {
			transaction.executeSql("UPDATE stories SET isRead = 1, isNew = 0 WHERE id = ?",
								   [story.id], onSuccess, onFail);
		});
	},
	
	markAllRead: function(feed, state, onSuccess, onFail) {
		onSuccess = onSuccess || this.nullDataHandler;
		onFail = onFail || this.errorHandler;
		
		state = state ? 1 : 0;
		
		this.transaction(function(transaction) {
			switch(feed.feedType) {
				case feedTypes.ftAllItems:
					transaction.executeSql("UPDATE stories SET isRead = ?",
										   [state], onSuccess, onFail);
					break;
				
				case feedTypes.ftStarred:
					transaction.executeSql("UPDATE stories SET isRead = ? WHERE isStarred = 1",
										   [state], onSuccess, onFail);
					break;
				
				default:
					transaction.executeSql("UPDATE stories SET isRead = ? WHERE fid = ?",
										   [state, feed.id], onSuccess, onFail);
					break;
			}			
		});		
	}
});