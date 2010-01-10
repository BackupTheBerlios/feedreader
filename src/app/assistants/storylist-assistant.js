function StorylistAssistant(feeds, index) {
	this.feeds = feeds;
	this.feedIndex = index;
	
	this.feed = feeds.list[index];
}

StorylistAssistant.prototype.setup = function() {
	// Setup application menu.
	this.controller.setupWidget(Mojo.Menu.appMenu, FeedReader.menuAttr, FeedReader.menuModel);

    // Setup the story list.
	this.controller.setupWidget("storyList", {
            itemTemplate:	"storylist/storylistRowTemplate", 
            listTemplate:	"storylist/storylistListTemplate", 
			formatters:  { 
				titleStyle: 	this.listFormatter.bind(this),
				summaryStyle: 	this.listFormatter.bind(this)
			},
            swipeToDelete:	false, 
            renderLimit: 	40,
            reorderable:	false
        },
        this.storyListModel = {items: this.feed.stories});
		
    this.controller.listen("storyList", Mojo.Event.listTap,
        				   this.showStory.bindAsEventListener(this));

	this.controller.get("feed-title").update(this.feed.title);

	for(var i = 0; i < this.feed.stories.length; i++) {
		this.feed.stories[i].isNew = false;
	}
	this.feed.numNew = 0;
};

StorylistAssistant.prototype.activate = function(event) {
};

StorylistAssistant.prototype.deactivate = function(event) {
	this.feeds.save();
};

StorylistAssistant.prototype.cleanup = function(event) {
};

StorylistAssistant.prototype.listFormatter = function(property, model) {
	if(model.isRead) {
		model.titleStyle = "story-title-read";
		model.contentStyle = "story-content-read";
	} else {
		model.titleStyle = "story-title-unread";
		model.contentStyle = "story-content-unread";
	}
};

StorylistAssistant.prototype.showStory = function(event) {
	if (!this.feed.stories[event.index].isRead) {
		this.feed.stories[event.index].isRead = true;
		this.feed.numUnRead--;
		this.storyListModel.items = this.feed.stories;
		this.controller.modelChanged(this.storyListModel);
	}
	
	this.controller.serviceRequest("palm://com.palm.applicationManager", {
		method: "open",
		parameters: {
			id: "com.palm.app.browser",
			params: {
				target: this.feed.stories[event.index].url
			}
		}
	});
};

StorylistAssistant.prototype.considerForNotification = function(params){
	if(params) {
		switch(params.type) {
			case "feed-update":
				if(this.feedIndex == params.feedIndex) {
					this.storyListModel.items = this.feed.stories;
					this.controller.modelChanged(this.storyListModel);
				}
				break;
		}
	}
	
	return params;
};
