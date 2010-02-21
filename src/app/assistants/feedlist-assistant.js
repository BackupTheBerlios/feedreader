/*
 *		app/assistants/feedlist-assistant.js
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

function FeedlistAssistant(feeds) {
	this.feeds = feeds;
	this.setupComplete = false;
	this.filter = "";
}

FeedlistAssistant.prototype.setup = function() {
	// Setup application menu.
	this.controller.setupWidget(Mojo.Menu.appMenu, FeedReader.menuAttr, FeedReader.menuModel);
	
	// Setup activation/de-activation handlers.
	var stageDocument = this.controller.stageController.document;
	Mojo.Event.listen(stageDocument, Mojo.Event.stageActivate, this.activateWindow.bindAsEventListener(this));
	Mojo.Event.listen(stageDocument, Mojo.Event.stageDeactivate, this.deactivateWindow.bindAsEventListener(this));
	
	// Setup the feed list.
	this.feedListWidget = this.controller.get("feedList");
	this.controller.setupWidget("feedList", {
        itemTemplate:	"feedlist/feedlistRowTemplate", 
        listTemplate:	"feedlist/feedlistListTemplate", 
		formatters: 	{
			feedIcon: 		this.getFeedIcon.bind(this),
			showOptions: 	this.getShowOptions.bind(this),
			title:			this.getTitle.bind(this),
			url:			this.getURL.bind(this),
			large:			this.getLargeFont.bind(this)
		},
		preventDeleteProperty: "preventDelete",
        addItemLabel:	$L("Add new Feed..."),
        swipeToDelete:	true,
        renderLimit: 	40,
        reorderable:	true,
		delay:			700,
		filterFunction: this.listFind.bind(this)
    },
    this.feedListModel = {
		items: this.feeds.list
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
    this.controller.setupWidget(Mojo.Menu.commandMenu, undefined, this.updateModel = {
		label: "",
        items: [
			{},	// Dummy to move refresh button.
            { icon: "refresh", disabled: this.feeds.updateInProgress, command: "do-fullUpdate" }
        ]
	});
	
	this.setupComplete = true;
	if(FeedReader.prefs.showChanges) {
		FeedReader.prefs.showChanges = false;
		this.controller.showDialog({template: "changelog/changelog-scene",
									assistant: new ChangelogAssistant(this.controller)});
	}
};

FeedlistAssistant.prototype.getFeedIcon = function(property, model) {
	switch(model.type) {
		case "allItems":	return { feedIcon: "allitems" };
		case "atom":		return { feedIcon: "atom" };
		case "rss":
		case "RDF":			return { feedIcon: "rss"};
		default:			return { feedIcon: "unknown"};
	}
	if(!model.enabled) {
		feedIcon += " disabled";
	}
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

FeedlistAssistant.prototype.getShowOptions = function(property, model) {
	return { showOptions: model.type == "allItems" ? "none" : "block" };		
};

FeedlistAssistant.prototype.activateWindow = function(event) {
	FeedReader.isActive = true;
};

FeedlistAssistant.prototype.deactivateWindow = function(event) {
	FeedReader.isActive = false;
};

FeedlistAssistant.prototype.activate = function(event) {
	if(this.setupComplete) {
		this.updateFeedModel();
	}
};

FeedlistAssistant.prototype.deactivate = function(event) {
};

FeedlistAssistant.prototype.cleanup = function(event) {
};

FeedlistAssistant.prototype.updateFeedModel = function(who) {
	if(this.setupComplete) {
		this.feedListModel.items = this.feeds.list;
		this.controller.modelChanged(this.feedListModel);
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
	    this.controller.popupSubmenu({
	      onChoose:  this.popupHandler,
	      placeNear: findPlace,
	      items: [
	        {label: $L("Mark all unread"),	command: "feed-unread"},
	        {label: $L("Mark all read"),	command: "feed-read"},
	        {label: $L("Edit"),				command: "feed-edit"},
			{label: $L("Update"),			command: "feed-update"},
	        {label: $L("Show"),				command: "feed-show"}
	        ]
	      });
	}
};

FeedlistAssistant.prototype.deleteFeed = function(event) {
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
	this.controller.stageController.pushScene("addfeed", this.feeds, this.popupIndex);
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
			this.feeds.updateFeed(this.popupIndex);
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
					this.feeds.update();
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
			case "feedlist-newfeed":
			case "feedlist-loaded":
			case "feedlist-editedfeed":
				this.updateFeedModel();
				params = undefined;
				break;
				
			case "feed-update":
				if(this.updateModel.items[1].disabled != this.feeds.updateInProgress) {
					this.updateModel.items[1].disabled = this.feeds.updateInProgress;
					this.controller.modelChanged(this.updateModel);
				}
				this.updateFeedModel();
				params = undefined;
				break;
		}
	}
	
	return params;
};
