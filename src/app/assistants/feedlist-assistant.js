/*
 *		app/assistants/feedlist-assistant.js
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

function FeedlistAssistant(feeds) {
	this.feeds = feeds;
	this.setupComplete = false;
	this.filter = "";
	this.feedListWidget = null;
	this.commandModel = {};
	
	this.activateWindowHandler = this.activateWindow.bindAsEventListener(this);
	this.deactivateWindowHandler = this.deactivateWindow.bindAsEventListener(this);
}

FeedlistAssistant.prototype.setup = function() {
	FeedReader.beginSceneSetup(this, true);

	// Setup activation/deactivation handlers.
	this.controller.listen(this.controller.stageController.document,
						   Mojo.Event.stageActivate, this.activateWindowHandler);
	this.controller.listen(this.controller.stageController.document,
						   Mojo.Event.stageDeactivate, this.deactivateWindowHandler);

	// Setup the feed list.
	this.feedListWidget = this.controller.get("feedList");
	this.controller.setupWidget("feedList", {
        itemTemplate:	"feedlist/feedlistRowTemplate", 
        listTemplate:	"feedlist/feedlistListTemplate", 
		formatters: 	{
			feedIcon: 		this.getFeedIcon.bind(this),
			title:			this.getTitle.bind(this),
			url:			this.getURL.bind(this),
			large:			this.getLargeFont.bind(this)
		},
		preventDeleteProperty:	"preventDelete",
		uniquenessProperty: 	"uid",
        addItemLabel:	$L("Add new Feed..."),
        swipeToDelete:	true,
        renderLimit: 	40,
        reorderable:	true,
		delay:			700,
		filterFunction: this.listFind.bind(this)
    });
	
	this.controller.setupWidget("feedSpinner", {
		spinnerSize: "small"
	});
	  
    // Setup event handlers: list selection, add, delete and reorder feed entry
    this.controller.listen("feedList", Mojo.Event.listTap,
        				   this.showFeed.bindAsEventListener(this));
    this.controller.listen("feedList", Mojo.Event.listAdd,
        				   this.addNewFeed.bindAsEventListener(this));    
    this.controller.listen("feedList", Mojo.Event.listDelete,
        				   this.deleteFeed.bindAsEventListener(this));
    this.controller.listen("feedList", Mojo.Event.listReorder,
					       this.reOrderFeed.bindAsEventListener(this));
	
	// Setup command menu.
	this.initCommandModel();
    this.controller.setupWidget(Mojo.Menu.commandMenu, undefined, this.commandModel);
	
	FeedReader.endSceneSetup(this);
	if(this.feeds.loaded) {
		Mojo.Log.info("FEEDLIST> List already loaded, removing splash");
		FeedReader.hideSplash();
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

FeedlistAssistant.prototype.getFeedIcon = function(property, model) {
	var feedIcon = "";
	
	switch(model.type) {
		case "allItems":	feedIcon = "allitems";	break;
		case "atom":		feedIcon = "atom";		break;
		case "rss":
		case "RDF":			feedIcon = "rss";		break;
		default:			feedIcon = "unknown";	break;
	}
	if(!model.enabled) {
		feedIcon += " disabled";
	}
	
	return { feedIcon: feedIcon };
};

FeedlistAssistant.prototype.getTitle = function(property, model) {
	return { title: this.feeds.getFeedTitle(model) };
};

FeedlistAssistant.prototype.getURL = function(property, model) {
	return { url: model.type == "allItems" ? $L("Aggregation of all feeds") : model.url };	
};

FeedlistAssistant.prototype.getLargeFont = function(property, model) {
	return { large: FeedReader.prefs.largeFont ? "large" : "" };
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
		this.updateFeedModel();
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
	this.feeds.spooler.aboutToClose();
};

FeedlistAssistant.prototype.updateFeedModel = function() {
	if(this.setupComplete && this.feedListWidget) {
		this.feedListWidget.mojo.setLengthAndInvalidate(this.feeds.list.length);
	}
};

FeedlistAssistant.prototype.showFeed = function(event) {
	var target = event.originalEvent.target.id;
	var itemIndex = this.feeds.list.indexOf(event.item);
	
	if(target !== "info") {
		this.controller.stageController.pushScene("storylist", this.feeds, itemIndex);
	} else  {
	    var myEvent = event;
	    var findPlace = myEvent.originalEvent.target;
	    this.popupIndex = itemIndex;
		
		var items = [
	        {label: $L("Mark all unread"),	command: "feed-unread"},
	        {label: $L("Mark all read"),	command: "feed-read"}
		];
		if(this.feeds.list[itemIndex].type != "allItems") {
	        items.push({label: $L("Edit"),	command: "feed-edit"});
		}
		items.push({label: $L("Update"),	command: "feed-update"});
	    items.push({label: $L("Show"),		command: "feed-show"});
		
	    this.controller.popupSubmenu({
	      onChoose:  this.popupHandler,
	      placeNear: findPlace,
	      items: items
	      });
	}
};

FeedlistAssistant.prototype.deleteFeed = function(event) {
	event.preventDefault();	// Needed, otherwise bad things can happen.
	this.feeds.deleteFeed(this.feeds.list.indexOf(event.item));
};

FeedlistAssistant.prototype.listFind = function(filterString, listWidget, offset, count) {
	var subset = [];
	var totalSubsetSize = 0;
	var lwrFilterString = filterString.toLowerCase();
	
	for(var i = 0; i < this.feeds.list.length; i++) {
		if (this.feeds.list[i].title.toLowerCase().include(lwrFilterString) ||
			this.feeds.list[i].url.toLowerCase().include(lwrFilterString)) {
			
			if ((subset.length < count) && (totalSubsetSize >= offset)) {
				subset.push(this.feeds.list[i]);
			}
			totalSubsetSize++;
		}
	}
	listWidget.mojo.noticeUpdatedItems(offset, subset);
	
	if (this.filter !== filterString) {
		listWidget.mojo.setLength(totalSubsetSize);
		listWidget.mojo.setCount(totalSubsetSize);
	}
	this.filter = filterString;
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
		    this.controller.stageController.pushScene("addfeed", this.feeds, this.popupIndex);
			break;
		
		case "feed-read":
			this.feeds.markAllRead(this.popupIndex);
			break;
			
		case "feed-unread":
			this.feeds.markAllUnRead(this.popupIndex);
			break;
			
		case "feed-update":
			this.feeds.interactiveUpdate = true;
			if(this.feeds.list[this.popupIndex].type == "allItems") {
				this.feeds.enqueueUpdate(this.popupIndex);
			}
			break;
			
		case "feed-show":
			this.controller.stageController.pushScene("storylist", this.feeds, this.popupIndex);
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
					this.feeds.enqueueUpdate(-1);
                	break;
				
				case "jslint-dummy":
					break;
            }
        }
    }
};

FeedlistAssistant.prototype.considerForNotification = function(params){
	if(params) {
		switch(params.type) {
			case "feedlist-loaded":
				this.feedListWidget.mojo.setLength(this.feeds.list.length);
				this.setupComplete = true;
				FeedReader.endSceneSetup(this);
				if(FeedReader.prefs.showChanges) {
					FeedReader.prefs.showChanges = false;
					this.controller.showDialog({template: "changelog/changelog-scene",
												assistant: new ChangelogAssistant(this.controller)});
				}
				break;
				
			case "feedlist-newfeed":
			case "feedlist-editedfeed":
				if(this.setupComplete) {
					this.updateFeedModel();
					params = undefined;
				}
				break;
				
			case "feed-update":
				if(this.setupComplete) {
					var updateIndex = FeedReader.prefs.leftHanded ? 1 : 0;
					if(this.commandModel.items[updateIndex].disabled != this.feeds.updateInProgress) {
						this.commandModel.items[updateIndex].disabled = this.feeds.updateInProgress;
						this.controller.modelChanged(this.commandModel);
					}
					this.updateFeedModel();
					params = undefined;
				}
				break;
		}
	}
	
	return params;
};
