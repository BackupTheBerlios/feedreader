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
	csGetFeedData:	"SELECT COALESCE(SUM(isNew), 0) AS numNew, COALESCE((COUNT(uuid) - SUM(isRead)), 0) AS numUnRead, feeds.*" +
					"  FROM feeds" +
					"  LEFT JOIN stories" +
					"    ON (stories.fid = feeds.id) OR (feeds.feedType = ? AND stories.isStarred = 1) OR (feeds.feedType = ?) ",
	csGetStoryIDs:	"SELECT id" +
					"  FROM stories",
	csSetVersion:	"INSERT INTO system (version) VALUES (?)"
};

/**
 * This class is the main database class. All database communication
 * is centralized here.
 * The feed list class encapsulated an object of this class.
 */
var database = Class.create({
	db:					null,
	migrateFromDepot:	false,
	migrator:			null,
	openTransactions:	0,
	ready:				true,
	loading:			true,
	
	updateSqls:			[
		{
			version:	11,
			sqls:		[
				"ALTER TABLE feeds ADD COLUMN username TEXT",
				"ALTER TABLE feeds ADD COLUMN password TEXT",
				"ALTER TABLE feeds ADD COLUMN fullStory BOOLEAN",
				"UPDATE feeds SET fullStory = 1"
			]
		}, {
			version:	12,
			sqls:		[
				"CREATE TRIGGER stories_after_insert AFTER INSERT ON stories" +
				"  BEGIN" +
				"    DELETE FROM stories" +
				"      WHERE NOT fid IN (SELECT id FROM feeds);" +
				"  END"
			]
		}
	],
	
	/** @private
	 * 
	 * Constructor.
	 */
	initialize: function() {
		// Transaction handlers.
		this.transactionSuccess = this.transactionSuccess.bind(this);
		this.transactionFailed = this.transactionFailed.bind(this);
		
		// Per-Query handlers.
		this.nullData = this.nullData.bind(this);
		this.error = this.error.bind(this);
		var checkVersion = this.checkVersion.bind(this);
		var initDB = this.initDB.bind(this);
		
		try {
			this.db = openDatabase("ext:FeedReader", "", "FeedReader Database");
			
			this.transaction(function(transaction) {
				transaction.executeSql("SELECT MAX(version) AS version FROM system",
									   [], checkVersion, initDB);
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
	transaction: function(fnc, onSuccess, onFail) {
		onSuccess = onSuccess || this.transactionSuccess;
		onFail = onFail || this.transactionFailed;
		
		this.openTransactions++;
		this.db.transaction(fnc, onFail, onSuccess);
	},
	
	/** @private
	 * 
	 * Event handler for failed transactions.
	 *
	 * @param	error		{Object}		error object
	 */
	transactionFailed: function(error) {
		Mojo.Log.error("DB> Transaction failed; error code:", error.code, "; message:", error.message);
		this.openTransactions--;
		this.handleMigration();
	},
	
	/** @private
	 * 
	 * Event handler for successful transactions.
	 */
	transactionSuccess: function() {
		this.openTransactions--;
		this.handleMigration();
	},

	/** @private
	 */
	handleMigration: function() {
		if(this.migrator) {
			if(this.migrator.finished && (this.openTransactions <= 0)) {
				this.ready = true;
				this.loading = false;
				Mojo.Controller.getAppController().sendToNotificationChain({ type: "feedlist-loaded" });
				delete this.migrator;
				if(FeedReader.prefs.updateOnStart) {
					FeedReader.feeds.enqueueUpdateAll();
				}
			}
		}		
	},
	
	/** @private
	 * 
	 * Called when opening the database succeeds.
	 */
	dbReady: function() {
		Mojo.Log.info("DB> Database schema ready");
		
		this.loading = this.migrateFromDepot;
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
								   '  allowHTML BOOL NOT NULL,' +
								   '  fullStory BOOL NOT NULL,' +
								   '  username TEXT,' +
								   '  password TEXT)',
								   [], this.nullData, this.error);
			
			// Create the story table.
			transaction.executeSql('CREATE TABLE stories (' +
								   '  id INTEGER PRIMARY KEY,' +
								   '  fid INT NOT NULL CONSTRAINT fk_stories_fid' +
								   '    REFERENCES feeds(id)' +
								   '    ON DELETE CASCADE ON UPDATE CASCADE,' +
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
								   [], this.nullData, this.error);
			transaction.executeSql('CREATE UNIQUE INDEX idx_stories_fid_uuid' +
								   '  ON stories (fid, uuid)',
								   [], this.nullData, this.error);
			
			// The storyurls table takes up the urls.
			transaction.executeSql('CREATE TABLE storyurls (' +
								   '  id INTEGER PRIMARY KEY,' +
								   '  sid INT NOT NULL CONSTRAINT fk_storyurls_sid' +
								   '    REFERENCES stories(id)' +
								   '    ON DELETE CASCADE ON UPDATE CASCADE,' +
								   '  title TEXT,' +
								   '  href TEXT)',
								   [], this.nullData, this.error);
			
			// Create triggers.
			transaction.executeSql("CREATE TRIGGER feeds_after_insert AFTER INSERT ON feeds" +
								   "  BEGIN" +
								   "    UPDATE feeds" +
								   "      SET feedOrder = (SELECT MAX(feedOrder) + 1 FROM feeds)" +
								   "      WHERE id = NEW.id" +
								   "        AND feedOrder = -1;" +
								   "  END", [], this.nullData, this.error);
			transaction.executeSql("CREATE TRIGGER feeds_after_delete AFTER DELETE ON feeds" +
								   "  BEGIN" +
								   "    UPDATE feeds SET feedOrder = feedOrder - 1 WHERE feedOrder > old.feedOrder;" +
								   "    DELETE FROM stories WHERE fid = old.id;" +
								   "  END", [], this.nullData, this.error);
			transaction.executeSql("CREATE TRIGGER stories_after_delete AFTER DELETE ON stories" +
								   "  BEGIN" +
								   "    DELETE FROM storyurls WHERE sid = old.id;" +
								   "  END", [], this.nullData, this.error);
			transaction.executeSql("CREATE TRIGGER stories_after_insert AFTER INSERT ON stories" +
								   "  BEGIN" +
								   "    DELETE FROM stories" +
								   "      WHERE NOT fid IN (SELECT id FROM feeds);" +
								   "  END", [], this.nullData, this.error);
			
			// Create the system table. It currently contains nothing but the version.
			transaction.executeSql('CREATE TABLE system (version INTEGER)',
								   [], this.nullData, this.error);
			transaction.executeSql('INSERT INTO system (version) VALUES(12)',
								   [], this.nullData, this.error);

			// Insert aggregated feeds with default settings.
			transaction.executeSql('INSERT INTO feeds (title, url, feedType, feedOrder, enabled, showPicture,' +
								   '                   showMedia, showListSummary, showListCaption,'+
								   '                   showDetailSummary, showDetailCaption, sortMode, allowHTML,' +
								   '                   fullStory, username, password)' +
								   '  VALUES(?, "starred", ?, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, "", "")',
								   ['Starred Items', feedTypes.ftStarred],
								   this.nullData, this.error);
			transaction.executeSql('INSERT INTO feeds (title, url, feedType, feedOrder, enabled, showPicture,' +
								   '                   showMedia, showListSummary, showListCaption,'+
								   '                   showDetailSummary, showDetailCaption, sortMode, allowHTML,' +
								   '                   fullStory, username, password)' +
								   '  VALUES(?, "allItems", ?, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, "", "")',
								   ['All Items', feedTypes.ftAllItems],
								   this.nullData, this.error);
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
		var destVer = version;
		var sqls = [];
		
		Mojo.Log.info("DB> Database already exists, version is:", version);
		
		for(var i = 0; i < this.updateSqls.length; i++) {
			if(this.updateSqls[i].version > destVer) {
				sqls = sqls.concat(this.updateSqls[i].sqls);
				destVer = this.updateSqls[i].version;
			}
		}
		
		if(destVer > version) {
			Mojo.Log.info("DB> Updating to schema version", destVer);
			var onSuccess = this.nullData;
			var onFail = this.error;
			
			for(i = 0; i < sqls.length; i++) {
				transaction.executeSql(sqls[i], [], onSuccess, onFail);
			}
			transaction.executeSql(commonSQL.csSetVersion, [destVer],
								   onSuccess, onFail);
		}
		
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
		onSuccess = onSuccess || this.nullData;
		onFail = onFail || this.error;
		
		var id = feed.id || null;
		
		var doUpdate = function(transaction) {
			Mojo.Log.info("DB> Updating feed, id is", id);
			transaction.executeSql('UPDATE feeds SET title = ?, url = ?, feedType = ?, feedOrder = ?, ' +
								   '    enabled = ?, showPicture = ?, showMedia = ?, showListSummary = ?,' +
								   '    showListCaption = ?, showDetailSummary = ?, showDetailCaption = ?,' +
								   '    sortMode = ?, allowHTML = ?, username = ?, password = ?, fullStory = ?' +
								   '  WHERE id = ?',
								   [feed.title, feed.url, feed.feedType, feed.feedOrder,
									feed.enabled ? 1 : 0,
									feed.showPicture ? 1 : 0, feed.showMedia ? 1 : 0,
									feed.showListSummary ? 1 : 0, feed.showListCaption ? 1 : 0,
									feed.showDetailSummary ? 1 : 0, feed.showDetailCaption ? 1 : 0,
									feed.sortMode, feed.allowHTML ? 1 : 0, feed.username,
									feed.password, feed.fullStory ? 1 : 0, id],
								   onSuccess.bind(feed), onFail);
		};
		
		var getID = function(transaction, result) {
			var f = new feedProto(feed);
			transaction.executeSql("SELECT last_insert_rowid() AS id", [],
				function(transaction, result) {
					if(result.rows.length > 0) {
						f.id = result.rows.item(0).id;
						onSuccess(f);
					}
				}, onFail);
		};
		
		var doInsert = function(transaction) {
			Mojo.Log.info("DB> inserting new feed");
			transaction.executeSql('INSERT INTO feeds (title, url, feedType, feedOrder,' +
								   '    enabled, showPicture, showMedia, showListSummary,' +
								   '    showListCaption, showDetailSummary, showDetailCaption,' +
								   '    sortMode, allowHTML, username, password, fullStory)' +
								   '  VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
								   [feed.title, feed.url, feed.feedType, -1,
									feed.enabled ? 1 : 0,
									feed.showPicture ? 1 : 0, feed.showMedia ? 1 : 0,
									feed.showListSummary ? 1 : 0, feed.showListCaption ? 1 : 0,
									feed.showDetailSummary ? 1 : 0, feed.showDetailCaption ? 1 : 0,
									feed.sortMode, feed.allowHTML ? 1 : 0, feed.username,
									feed.password, feed.fullStory ? 1 : 0],
									getID, onFail);
		};
		
		this.transaction(function(transaction) {
			if(id !== null) {
				doUpdate(transaction);
			} else {
				doInsert(transaction);
			}
		});
	},
	
	/**
	 * Set the type of a feed.
	 *
	 * @param	feed		{object}		feed object
	 * @param	type		{int}			type of the feed
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */
	setFeedType: function(feed, type, onSuccess, onFail) {
		onSuccess = onSuccess || this.nullData;
		onFail = onFail || this.error;
		
		this.transaction(function(transaction) {
			transaction.executeSql("UPDATE feeds SET feedType = ? WHERE id = ?",
								   [type, feed.id], onSuccess, onFail);
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
		onSuccess = onSuccess || this.nullData;
		onFail = onFail || this.error;
		
		this.transaction(function(transaction) {
			transaction.executeSql("UPDATE feeds SET sortMode = ? WHERE id = ?",
								   [feed.sortMode, feed.id], onSuccess, onFail);
		});
	},
	
	/**
	 * Disable a feed.
	 *
	 * @param 	feed		{object}		feed object
	 * @param	url			{String}		url of the feed to disable
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */
	disableFeed: function(feed, onSuccess, onFail) {
		onSuccess = onSuccess || this.nullData;
		onFail = onFail || this.error;
		
		this.transaction(function(transaction) {
			transaction.executeSql("UPDATE feeds SET feedType = ?, enabled = 0 WHERE id = ?",
								   [feedTypes.ftUnknown, feed.id], onSuccess, onFail);
		});		
	},
	
	/**
	 * Delete a feed.
	 *
	 * @param	feed		{object}		feed to delete
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */
	deleteFeed: function(feed, onSuccess, onFail) {
		onSuccess = onSuccess || this.nullData;
		onFail = onFail || this.error;
		
		Mojo.Log.info("DB> deleting feed", feed.id);
		
		this.transaction(function(transaction) {
			transaction.executeSql("DELETE FROM feeds WHERE id = ?",
				[feed.id], onSuccess, onFail);
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
		onSuccess = onSuccess || this.nullData;
		onFail = onFail || this.error;
		
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
		onFail = onFail || this.error;
		
		this.transaction(function(transaction) {
			transaction.executeSql("SELECT id, feedOrder, url, username, password" +
								   "  FROM feeds" +
								   "  WHERE feedType >= ? AND enabled = 1" +
								   "  ORDER BY feedOrder", [feedTypes.ftUnknown],
				function(transaction, result) {
					var list = [];
					for(var i = 0; i < result.rows.length; i++) {
						list.push(result.rows.item(i));
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
		onFail = onFail || this.error;
		
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
		onFail = onFail || this.error;
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
							list.push(new feedProto(result.rows.item(i)));
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
		onFail = onFail || this.error;
		
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
		onFail = onFail || this.error;
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
		onFail = onFail || this.error;
			
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
	 * Get the count of new stories.
	 *
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */
	getNewStoryCount: function(onSuccess, onFail) {
		Mojo.assert(onSuccess, "DB> getNewStoryCount needs data handler");
		onFail = onFail || this.error;
		
		this.transaction(function(transaction) {
			transaction.executeSql("SELECT COUNT(*) AS newCount FROM stories WHERE isNew = 1", [],
				function(transaction, result) {
					if(result.rows.length > 0) {
						onSuccess(result.rows.item(0).newCount);
					} else {
						onSuccess(0);
					}
				}, onFail);
		});
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
		onFail = onFail || this.error;
		
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
						 "       f.showListSummary AS showSummary, f.fullStory" +
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
	 * Retrieve a list of urls of stories.
	 *
	 * @param	feed		{Object}		feed object
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */
	getFeedURLList: function(feed, onSuccess, onFail) {
		Mojo.assert(onSuccess, "DB> getFeedURLList needs data handler");
		onFail = onFail || this.error;
		
		// This function will assemble the result set.
		var handleResult = function(transaction, result) {
			var list = [];
			for(var i = 0; i < result.rows.length; i++) {
				list.push({
					title:	result.rows.item(i).title,
					url:	result.rows.item(i).href
				});
			}
			onSuccess(list);
		};

		// Build the basic SELECT statement.
		var selectStmt = "SELECT s.title, su.href" +
						 "  FROM stories AS s" +
						 "  INNER JOIN storyurls AS su ON (s.id = su.sid)";
		
		// Build the ORDER clause.
		var orderAndLimit = " ORDER BY s.pubdate DESC";
		
		switch(feed.feedType) {
			case feedTypes.ftAllItems:
				this.transaction(function(transaction) {
					transaction.executeSql(selectStmt + orderAndLimit,
										   [], handleResult, onFail);
				});
				break;
			
			case feedTypes.ftStarred:
				this.transaction(function(transaction) {
					transaction.executeSql(selectStmt + " WHERE s.isStarred = 1" + orderAndLimit,
										   [], handleResult, onFail);
				});
				break;
			
			default:
				this.transaction(function(transaction) {
					transaction.executeSql(selectStmt + " WHERE s.fid = ?" + orderAndLimit,
										   [feed.id],
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
		onFail = onFail || this.error;
		
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
		onFail = onFail || this.error;
		
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
					}
					onSuccess(feed, story, urls);
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
					} else {
						Mojo.Log.error("DB> Unable to retrieve feed for story", id);
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
					} else {
						Mojo.Log.error("DB> Unable to retrieve story data of story", id);
					}
				}, onFail);
		});
	},
	
	/**
	 * Called to indicate a beginning update.
	 *
	 * @param 	feed		{object}		feed object
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */
	beginStoryUpdate: function(feed, onSuccess, onFail) {
		onSuccess = onSuccess || this.nullData;
		onFail = onFail || this.error;
		var nullData = this.nullData;
		var onNotify = this.notifyOfUpdate.bind(this, true);
		
		var date = new Date();
		var keepthreshold = date.getTime() - (FeedReader.prefs.storyKeepTime * 60 * 60 * 1000); 
		var newthreshold = date.getTime() - (24 * 60 * 60 * 1000);
		
		this.transaction(function(transaction) {
			transaction.executeSql("UPDATE stories" +
								   "  SET isNew = 0" +
								   "  WHERE (isRead = 1" +
								   "    OR pubdate < ?)" +
								   "    AND fid = ?",
								   [newthreshold, feed.id],
								   nullData, onFail);
			transaction.executeSql("UPDATE stories" +
								   "  SET flag = 1" +
								   "  WHERE isStarred = 0"+
								   "    AND (isRead = 1" +
								   "    OR pubdate < ?)" +
								   "    AND fid = ?",
								   [keepthreshold, feed.id], onSuccess, onFail);
			transaction.executeSql("SELECT feedOrder FROM feeds WHERE id = ?",
								   [feed.id], onNotify, onFail);
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
	 * @param 	feed		{object}		feed object
	 * @param	successful	{bool}			update was successful?
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */
	endStoryUpdate: function(feed, successful, onSuccess, onFail) {
		onSuccess = onSuccess || this.nullData;
		onFail = onFail || this.error;
		var onNotify = this.notifyOfUpdate.bind(this, false);
		
		this.transaction(function(transaction) {
			if(successful) {
				transaction.executeSql("DELETE FROM stories" +
									   "  WHERE flag = 1" +
									   "    AND isStarred = 0" +
									   "    AND fid = ?",
									   [feed.id], onSuccess, onFail);
			} else {
				transaction.executeSql("UPDATE stories" +
									   "  SET flag = 0" +
									   "  WHERE fid = ?",
									   [feed.id], onSuccess, onFail);
			}
			transaction.executeSql("SELECT feedOrder FROM feeds WHERE id = ?",
								   [feed.id], onNotify, onFail);
		});
	},
	
	/**
	 * Add or edit a story.
	 *
	 * @param 	feed		{object}		feed object
	 * @param	story		{Object}		story object
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */
	addOrEditStory: function(feed, story, onSuccess, onFail) {
		onSuccess = onSuccess || this.nullData;
		onFail = onFail || this.error;
		
		var nullData = this.nullData;
		var error = this.error;
		
		var insertURLs = function(transaction, result) {
			var sid = result.insertId;
			transaction.executeSql("DELETE FROM storyurls WHERE sid = ?",
								   [sid], nullData, error);
			for(var i = 0; i < story.url.length; i++) {
				transaction.executeSql("INSERT INTO storyurls (sid, title, href)" +
									   "  VALUES(?, ?, ?)",
									   [sid, story.url[i].title, story.url[i].href],
										nullData, error);
			}
			onSuccess();
		};
		
		this.transaction(
			function(transaction) {
				transaction.executeSql("SELECT id" +
									   "  FROM stories" +
									   "  WHERE fid = ?" +
									   "    AND uuid = ?",
									   [feed.id, story.uuid],
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
													story.video,
													story.pubdate ? story.pubdate : 0,
													sid],
												   onSuccess, onFail);
							insertURLs(transaction, { insertId: sid });
						} else {
							var date = new Date();
							var isNew = story.pubdate >= (date.getTime() - (24 * 60 * 60 * 1000));
							transaction.executeSql("INSERT INTO stories" +
												   "  (fid, uuid, title, summary, picture, audio, video, pubdate, isRead, isNew, isStarred, flag)" +
												   "  VALUES(?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, 0)",
												   [feed.id, story.uuid, story.title, story.summary, story.picture,
													story.audio, story.video,
													story.pubdate ? story.pubdate : 0,
													isNew ? 1 : 0],
												   insertURLs, onFail);
						}
					},
					onFail);
			});
	},

	/**
	 * Set the starred flag of a story.
	 *
	 * @param	story		{Object}		story object
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */	
	markStarred: function(story, onSuccess, onFail) {
		onSuccess = onSuccess || this.nullData;
		onFail = onFail || this.error;
		this.transaction(function(transaction) {
			transaction.executeSql("UPDATE stories SET isStarred = ? WHERE id = ?",
								   [story.isStarred ? 1 : 0, story.id], onSuccess, onFail);
		});
	},
	
	/**
	 * Reset the starred flag all stories of a feed.
	 *
	 * @param	story		{Object}		story object
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */	
	markAllUnStarred: function(feed, onSuccess, onFail) {
		onSuccess = onSuccess || this.nullData;
		onFail = onFail || this.error;
		
		var sql = "UPDATE stories SET isStarred = 0";
		if(feed.feedType >= feedTypes.ftUnknown) {
			sql += " WHERE fid = " + feed.id;
		}
		
		this.transaction(function(transaction) {
			transaction.executeSql(sql, [], onSuccess, onFail);
		});
	},
	
	/**
	 * Mark a story as being read.
	 *
	 * @param	story		{Object}		story object
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */	
	markStoryRead: function(story, onSuccess, onFail) {
		onSuccess = onSuccess || this.nullData;
		onFail = onFail || this.error;
		this.transaction(function(transaction) {
			transaction.executeSql("UPDATE stories SET isRead = 1, isNew = 0 WHERE id = ?",
								   [story.id], onSuccess, onFail);
		});
	},
	
	/**
	 * Mark all stories of a feed as being read.
	 *
	 * @param	feed		{Object}		feed object
	 * @param	state		{boolean}		state of the flag
	 * @param	onSuccess	{function}		function to be called on success
	 * @param	onFail		{function}		function to be called on failure
	 */	
	markAllRead: function(feed, state, onSuccess, onFail) {
		onSuccess = onSuccess || this.nullData;
		onFail = onFail || this.error;
		
		state = state ? 1 : 0;
		
		this.transaction(function(transaction) {
			switch(feed.feedType) {
				case feedTypes.ftAllItems:
					transaction.executeSql("UPDATE stories SET isRead = ?, isNew = 0",
										   [state], onSuccess, onFail);
					break;
				
				case feedTypes.ftStarred:
					transaction.executeSql("UPDATE stories SET isRead = ?, isNew = 0 WHERE isStarred = 1",
										   [state], onSuccess, onFail);
					break;
				
				default:
					transaction.executeSql("UPDATE stories SET isRead = ?, isNew = 0 WHERE fid = ?",
										   [state, feed.id], onSuccess, onFail);
					break;
			}			
		});		
	}
});