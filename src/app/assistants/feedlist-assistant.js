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
	this.controller.setupWidget("feedList", {
        itemTemplate:	"feedlist/feedlistRowTemplate", 
        listTemplate:	"feedlist/feedlistListTemplate", 
		formatters: 	{
			feedIcon: this.listFormatter.bind(this)
		},
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
	this.controller.setupWidget("feedSpinner", { property: "updating" });
	  
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
    this.controller.setupWidget(Mojo.Menu.commandMenu, undefined, {
		label: "",
        items: [
            { icon: "refresh", checkEnabled: true, command: "do-fullUpdate" }
        ]
	});
	
	this.controller.stageController.setWindowOrientation("free");
	this.setupComplete = true;
};

FeedlistAssistant.prototype.listFormatter = function(property, model) {
	if (model.type == "atom") {
		model.feedIcon = "feed-icon-atom";
	} else if (model.type == "unknown") {
		model.feedIcon = "feed-icon-unknown";
	} else {
		model.feedIcon = "feed-icon-rss";		
	}

	if(!model.enabled){
		model.feedIcon.concat("disabled");
	}
};

FeedlistAssistant.prototype.activateWindow = function(event) {
	FeedReader.isActive = true;
};

FeedlistAssistant.prototype.deactivateWindow = function(event) {
	FeedReader.isActive = false;	
};

FeedlistAssistant.prototype.activate = function(event) {
	if(this.setupComplete) {
		this.feedListModel.items = this.feeds.list;
		this.controller.modelChanged(this.feedListModel);
	}
};

FeedlistAssistant.prototype.deactivate = function(event) {
};

FeedlistAssistant.prototype.cleanup = function(event) {
};

FeedlistAssistant.prototype.showFeed = function(event) {
	var target = event.originalEvent.target.id;
	
	if(target !== "info") {
		this.controller.stageController.pushScene("storylist", this.feeds, event.index);
	} else  {
	    var myEvent = event;
	    var findPlace = myEvent.originalEvent.target;
	    this.popupIndex = event.index;
	    this.controller.popupSubmenu({
	      onChoose:  this.popupHandler,
	      placeNear: findPlace,
	      items: [
	        {label: $L("Mark all unread"), command: "feed-unread"},
	        {label: $L("Mark all read"), command: "feed-read"},
	        {label: $L("Edit"), command: "feed-edit"},
			{label: $L("Update"), command: "feed-update"},
	        {label: $L("Show"), command: "feed-show"}
	        ]
	      });
	}
};

FeedlistAssistant.prototype.deleteFeed =  function(event) {
    this.feeds.list.splice(this.feeds.list.indexOf(event.item), 1);
    this.feedListModel.items = this.feeds.list;
	this.feeds.save();
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
	var from = this.feeds.list[event.fromIndex];
	var to   = this.feeds.list[event.toIndex];
	this.feeds.list[event.fromIndex] = to;
	this.feeds.list[event.toIndex]   = from;
	this.feeds.save();
};

FeedlistAssistant.prototype.addNewFeed = function(event) {
    this.controller.showDialog({template: "addfeed/addfeed-scene",
        					    assistant: new AddfeedAssistant(this.controller, this.feeds)});
};

FeedlistAssistant.prototype.popupHandler = function(command) {
	switch(command) {
		case "feed-edit":
		    this.controller.showDialog({template: "addfeed/addfeed-scene",
        							    assistant: new AddfeedAssistant(this.controller,
											this.feeds,
											this.popupIndex)});
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
    if (event.type == Mojo.Event.commandEnable) {
        if (FeedReader.feeds.updateInProgress && (event.command == "do-fullUpdate")) {
            event.preventDefault();
		}
    } else {
        if(event.type == Mojo.Event.command) {
            switch(event.command) {
                case "do-fullUpdate":
					this.feeds.update();
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
				this.feedListModel.items = this.feeds.list;
				this.controller.modelChanged(this.feedListModel);
				params = undefined;
				break;
				
			case "feed-update":
				if(!params.inProgress) {
					this.feedListModel.items[params.feedIndex] = this.feeds.list[params.feedIndex];
				}
					
				this.feedListModel.items[params.feedIndex].updating = params.inProgress;
				this.controller.modelChanged(this.feedListModel);
				params = undefined;
				break;
		}
	}
	
	return params;
};
