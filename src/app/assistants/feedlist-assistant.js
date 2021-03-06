/*
 *		app/assistants/feedlist-assistant.js
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

function FeedlistAssistant(feeds) {
	this.feeds = feeds;
	this.filter = "dummyString";
	this.feedListWidget = null;
	this.commandModel = {};
	this.popupItem = null;
	
	this.activateWindow = this.activateWindow.bindAsEventListener(this);
	this.deactivateWindow = this.deactivateWindow.bindAsEventListener(this);
	
	this.listFind = this.listFind.bind(this);
	this.updateItems = this.updateItems.bind(this);
	this.setListLength = this.setListLength.bind(this);
	
	this.showFeed = this.showFeed.bindAsEventListener(this);
	this.addNewFeed = this.addNewFeed.bindAsEventListener(this);
	this.deleteFeed = this.deleteFeed.bindAsEventListener(this);
	this.reOrderFeed = this.reOrderFeed.bindAsEventListener(this);
}

FeedlistAssistant.prototype.setup = function() {
	SceneControl.beginSceneSetup(this, true);

	// Setup activation/deactivation handlers.
	this.controller.listen(this.controller.stageController.document,
						   Mojo.Event.stageActivate, this.activateWindow);
	this.controller.listen(this.controller.stageController.document,
						   Mojo.Event.stageDeactivate, this.deactivateWindow);

	// Setup the feed list.
	this.feedListWidget = this.controller.get("feedList");
	this.controller.setupWidget("feedList", {
        itemTemplate:	FeedReader.scrimMode ?
						"feedlist/feedlistScrimRowTemplate" :
						"feedlist/feedlistRowTemplate",
        listTemplate:	"feedlist/feedlistListTemplate", 
		formatters: 	{
			feedIcon: 	this.listFormatter.bind(this, "feedIcon"),
			title:		this.listFormatter.bind(this, "title"),
			url:		this.listFormatter.bind(this, "url"),
			large:		this.listFormatter.bind(this, "large")
		},
		preventDeleteProperty:	"preventDelete",
		uniquenessProperty: 	"id",
        addItemLabel:	FeedReader.scrimMode ? undefined : $L("Add new Feed..."),
        swipeToDelete:	true,
        renderLimit: 	40,
        reorderable:	true,
		delay:			700,
		filterFunction: this.listFind
    });
	
	this.controller.setupWidget("feedSpinner", {
		spinnerSize: "small"
	});
	  
    // Setup event handlers: list selection, add, delete and reorder feed entry
    this.controller.listen("feedList", Mojo.Event.listTap, this.showFeed);
    this.controller.listen("feedList", Mojo.Event.listAdd, this.addNewFeed);
    this.controller.listen("feedList", Mojo.Event.listDelete, this.deleteFeed);
    this.controller.listen("feedList", Mojo.Event.listReorder, this.reOrderFeed);
	
	// Setup command menu.
	this.initCommandModel();
    this.controller.setupWidget(Mojo.Menu.commandMenu, undefined, this.commandModel);

	if(this.feeds.isReady()) {
		Mojo.Log.info("FL> databse ready at end of setup");
		delete this.loadHandler;
		this.refreshList();
	}
};

FeedlistAssistant.prototype.initCommandModel = function() {
	this.commandModel.label = "";
	this.commandModel.items = [
		{},	// Dummy to move refresh button.
		{ icon: "refresh", disabled: this.feeds.updateInProgress, command: "do-fullUpdate" }
	];
	
	if(!FeedReader.prefs.leftHanded) {
		this.commandModel.items.reverse();
	}
};

FeedlistAssistant.prototype.listFormatter = function(attribute, property, model) {
	if(!model) {
		return {};
	}

	switch(attribute) {
		case "feedIcon":	return { feedIcon: this.feeds.getFeedIconClass(model) };
		case "title":		return { title: this.feeds.getFeedTitle(model) };
		case "url":			return { url: this.feeds.getFeedURL(model) };
		case "large":		return { large: FeedReader.prefs.largeFont ? "large" : "" };
	}
	
	return {};
};

FeedlistAssistant.prototype.closeDashboard = function() {
	var appController = Mojo.Controller.getAppController();
	var dashboardStageController = appController.getStageProxy(FeedReader.dashboardStageName);
	
	if(dashboardStageController) {
		dashboardStageController.delegateToSceneAssistant("closeDashboard");
	}
};

FeedlistAssistant.prototype.activate = function(event) {
	if(this.setupComplete) {
		this.initCommandModel();
		this.controller.modelChanged(this.commandModel);
		this.refreshList();
	} else {
		if(this.feeds.isReady()) {
			this.filter = "";
			this.refreshList();
		}
		if(FeedReader.prefs.showChanges) {
			FeedReader.prefs.showChanges = false;
			this.controller.showDialog({template: "changelog/changelog-scene",
										assistant: new ChangelogAssistant(this.controller)});
		}
	}

	FeedReader.isActive = true;
	this.closeDashboard();
};

FeedlistAssistant.prototype.deactivate = function(event) {
	FeedReader.isActive = false;
};

FeedlistAssistant.prototype.activateWindow = function(event) {
	if(this.controller.stageController.topScene().sceneName == "feedlist") {
		FeedReader.isActive = true;
		this.closeDashboard();
	}
	Mojo.Controller.getAppController().sendToNotificationChain({
		type: "app-activate"
	});		
};
 
FeedlistAssistant.prototype.deactivateWindow = function(event) {
	FeedReader.isActive = false;
};   

FeedlistAssistant.prototype.cleanup = function(event) {
	Mojo.Log.info("FEEDLIST> About to close app");

	this.controller.stopListening(this.controller.stageController.document,
								  Mojo.Event.stageActivate, this.activateWindow);
	this.controller.stopListening(this.controller.stageController.document,
								  Mojo.Event.stageDeactivate, this.deactivateWindow);
    this.controller.stopListening("feedList", Mojo.Event.listTap, this.showFeed);
    this.controller.stopListening("feedList", Mojo.Event.listAdd, this.addNewFeed);
    this.controller.stopListening("feedList", Mojo.Event.listDelete, this.deleteFeed);
    this.controller.stopListening("feedList", Mojo.Event.listReorder, this.reOrderFeed);

	this.feeds.spooler.aboutToClose();
};

FeedlistAssistant.prototype.refreshList = function() {
	this.feeds.getFeedCount(this.filter, this.setListLength);
};

FeedlistAssistant.prototype.refreshUpdateLock = function () {
	var updateIndex = FeedReader.prefs.leftHanded ? 1 : 0;
	this.commandModel.items[updateIndex].disabled = this.feeds.isUpdating();
	this.controller.modelChanged(this.commandModel);
};

FeedlistAssistant.prototype.showFeed = function(event) {
	var target = event.originalEvent.target.id;
	if(target !== "info") {
		this.controller.stageController.pushScene("storylist", this.feeds, event.item);
	} else  {
	    var findPlace = event.originalEvent.target;		
		this.popupItem = event.item;
		
		var items = [
	        { label: $L("Mark all unread"),	command: "feed-unread" },
	        { label: $L("Mark all read"),	command: "feed-read" },
			{ label: $L("Unstar all"),		command: "feed-unstar" }
		];
		if(this.popupItem.feedType >= feedTypes.ftUnknown) {
	        items.push({ label: $L("Edit"), command: "feed-edit" });
		}
		if(this.popupItem.feedType != feedTypes.ftStarred) {
			items.push({ label: $L("Update"), command: "feed-update" });
		}
	    items.push({ label: $L("Show"),		command: "feed-show" });
		
	    this.controller.popupSubmenu({
	      onChoose: 	this.popupHandler,
	      placeNear:	findPlace,
	      items: 		items
	      });
	}
};

FeedlistAssistant.prototype.deleteFeed = function(event) {
	this.feeds.deleteFeed(event.item);
};

FeedlistAssistant.prototype.listFind = function(filterString, listWidget, offset, count) {
	if(this.feeds.isReady()) {
		if(this.filter != filterString) {
			this.filter = filterString;
			this.feeds.getFeedCount(this.filter, this.setListLength);
		} else {
			this.feeds.getFeeds(this.filter, offset, count, this.updateItems);
		}
	}
};

FeedlistAssistant.prototype.updateItems = function(offset, items) {
	if(FeedReader.scrimMode) {
		// Scrim-Mode: Display a single pseudo-feed
		offset = 0;
		items = this.feeds.getCopyrightFeed();
	}

	this.feedListWidget.mojo.noticeUpdatedItems(offset, items);

	SceneControl.endSceneSetup(this);
	SceneControl.hideSplash();
};

FeedlistAssistant.prototype.setListLength = function(count) {
	if(FeedReader.scrimMode) {
		count = 1;	// Scrim-Mode: Display a single pseudo-feed
	}

	if(this.filter !== "") {
		// Stop the FilterField spinner and set the found count.
		this.feedListWidget.mojo.setCount(count);
	}
	
	this.feedListWidget.mojo.setLengthAndInvalidate(count);
	this.refreshUpdateLock();
};

FeedlistAssistant.prototype.reOrderFeed =  function(event) {
	this.feeds.moveFeed(event.fromIndex, event.toIndex);
};

FeedlistAssistant.prototype.addNewFeed = function(event) {
	this.controller.stageController.pushScene("addfeed", this.feeds, undefined);
};

FeedlistAssistant.prototype.popupHandler = function(command) {
	switch(command) {
		case "feed-edit":
		    this.controller.stageController.pushScene("addfeed", this.feeds, this.popupItem);
			break;
		
		case "feed-read":
			this.feeds.markAllRead(this.popupItem);
			break;
			
		case "feed-unread":
			this.feeds.markAllUnRead(this.popupItem);
			break;
		
		case "feed-unstar":
			this.feeds.markAllUnStarred(this.popupItem);
			this.refreshList();
			break;
			
		case "feed-update":
			this.feeds.interactiveUpdate = true;
			if(this.popupItem.feedType == feedTypes.ftAllItems) {
				this.feeds.enqueueUpdateAll();
			} else {
				this.feeds.enqueueUpdate(this.popupItem);
			}
			break;
			
		case "feed-show":
			this.controller.stageController.pushScene("storylist", this.feeds, this.popupItem);
			break;
	}	  
};

FeedlistAssistant.prototype.handleCommand = function(event) {       
    if (event.type === Mojo.Event.commandEnable) {
        if (FeedReader.feeds.updateInProgress && (event.command == "do-fullUpdate")) {
            event.preventDefault();
		}
    } else {
        if(event.type === Mojo.Event.command) {
            switch(event.command) {
                case "do-fullUpdate":
					this.feeds.interactiveUpdate = true;
					this.feeds.enqueueUpdateAll();
                	break;
				
				case "jslint-dummy":
					break;
            }
        }
    }
};

FeedlistAssistant.prototype.loadHandler = function() {
	if(this.feedListWidget) {
		Mojo.Log.info("FEEDLIST> db ready; setup completed");
		if(!this.setupComplete) {
			this.filter = "";
			this.refreshList();
		}
	}
};

FeedlistAssistant.prototype.considerForNotification = function(params){
	if(params) {
		switch(params.type) {
			case "feedlist-changed":
				if(this.feeds.isReady()) {
					this.refreshList();
					params = undefined;
				}
				break;
			
			case "feedlist-loaded":
				if(this.loadHandler) {
					this.loadHandler();
				}
				break;
				
			case "feed-update":
				if(this.feedListWidget) {
					var node = this.feedListWidget.mojo.getNodeByIndex(params.feedOrder);
					var item = this.feedListWidget.mojo.getItemByNode(node);
					if(item && params.inProgress) {
						item.spinning = true;
						var items = [];
						items.push(item);
						this.feedListWidget.mojo.noticeUpdatedItems(params.feedOrder, items);
					} else {
						this.feeds.getFeeds(this.filter, params.feedOrder, 1, this.updateItems);
						params = undefined;
					}
				}
				break;
			
			case "updatestate-changed":
				if(!this.feeds.isUpdating()) {
					this.refreshList();
				} else {
					this.refreshUpdateLock();
				}
				break;
		}
	}
	
	return params;
};
