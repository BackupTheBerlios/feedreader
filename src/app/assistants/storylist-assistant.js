/*
 *		app/assistants/storylist-assistant.js
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

/*
 * The sort function are currently not in use. Just as the feed.sortMode
 * property these functions are dedicated to a future version of FeedReader.
 */
 
/** @private
 *
 * Sort stories, so that unread ones come in front. 
 */
function SortRead(a, b) {
	if(a.isRead == b.isRead) {
		return 0;
	} else if(a.isRead) {
		return 1;
	} else {
		return -1;
	}
}

/** @private
 *
 * Sort stories by date.
 */
function SortDate(a, b) {
	return a.intDate - b.intDate;
}

function StorylistAssistant(feeds, index) {
	this.feeds = feeds;
	this.feedIndex = index;
	
	this.feed = this.feeds.list[index];
	this.filter = "";
	
	this.listFindHandler = this.listFind.bind(this);
	this.setupComplete = false;
}

StorylistAssistant.prototype.setup = function() {
	// Setup application menu.
	this.controller.setupWidget(Mojo.Menu.appMenu, FeedReader.menuAttr, FeedReader.menuModel);

	this.controller.get("feed-title").update(this.feeds.getFeedTitle(this.feed));
	this.controller.get("appIcon").className += " " + this.feeds.getFeedHeaderIcon(this.feed);

	this.controller.setDefaultTransition(Mojo.Transition.defaultTransition);

    // Setup the story list.
	this.storyListWidget = this.controller.get("storyList");
	this.controller.setupWidget("storyList", {
		itemTemplate:	"storylist/storylistRowTemplate", 
		listTemplate:	"storylist/storylistListTemplate", 
		formatters:  { 
			"isRead": 			this.getTitleStyle.bind(this),
			"titleColor":		this.getTitleColor.bind(this),
			"contentStyle": 	this.getContentStyle.bind(this),
			"summary":			this.getSummary.bind(this),
			"originFeed":		this.getOrigin.bind(this)
		},
		swipeToDelete:	false, 
		renderLimit: 	100,
		reorderable:	false,
		delay:			700,
		filterFunction: this.listFindHandler
	},
	this.storyListModel = {
		items: this.feed.stories
	});
	
	this.controller.listen("storyList", Mojo.Event.listTap,
					   this.showStory.bindAsEventListener(this));

	// Setup command menu.
    this.controller.setupWidget(Mojo.Menu.commandMenu, undefined, this.commandModel = {
		label: "",
        items: [
			{
				items: [
					{
						icon: "back",
						disabled: this.feedIndex === 0,
						command: "do-previousFeed"
					},
					{
						icon: "forward",
						disabled: this.feedIndex === (this.feeds.list.length - 1),
						command: "do-nextFeed"
					}
				]
			},
            {
				icon: "refresh",
				disabled: this.feeds.updateInProgress,
				command: "do-feedUpdate"
			}
        ]
	});
	
	this.setupComplete = true;
};

StorylistAssistant.prototype.updateModel = function() {
	if(this.setupComplete) {
		this.prepareFeed();
		this.storyListModel.items = this.feed.stories;
		this.storyListWidget.mojo.noticeUpdatedItems(0, this.storyListModel.items);
	}
};

StorylistAssistant.prototype.activate = function(event) {
	this.updateModel();
};

StorylistAssistant.prototype.deactivate = function(event) {
	this.feeds.markSeen(this.feedIndex);
};

StorylistAssistant.prototype.cleanup = function(event) {
};

StorylistAssistant.prototype.getTitleStyle = function(property, model) {
	return { titleStyle: property ? "normal-text" : "bold-text" };
};

StorylistAssistant.prototype.getTitleColor = function(property, model) {
	return { titleColor: FeedReader.prefs.titleColor };
};

StorylistAssistant.prototype.getContentStyle = function(property, model) {
	return { contentStyle: "normal-text" };
};

StorylistAssistant.prototype.getOrigin = function(property, model) {
	if(!property) {
		return undefined;
	}
	
	return { origin: "(" + this.feeds.list[property].title + 
	//' #' + this.feed.stories.indexOf(model) +
	")" };
};

StorylistAssistant.prototype.getSummary = function(property, model) {
	if(!property) {
		return undefined;
	} else if(property.length > (FeedReader.prefs.summaryLength + 10)) {
		return { shortSummary: property.slice(0, FeedReader.prefs.summaryLength - 1) + '...' };
	} else {
		return { shortSummary: property };
	}	
};

StorylistAssistant.prototype.prepareFeed = function() {
	if(this.feed.type != "allItems") {
		return;
	}
	
	var j, stories;
	
	try {
		this.feeds.updatePseudoFeeds(true);
		this.feed = undefined;	// clear first.
		this.feed = {
			type: "allItems",
			stories: []
		};
		for(var i = 0; i < this.feeds.list.length; i++) {
			if((this.feeds.list[i].type == "allItems") ||
			   (this.feeds.list[i].type == "allUnRead") ||
			   (this.feeds.list[i].type == "allNew")) {
				continue;
			}
			
			for(j = 0; j < this.feeds.list[i].stories.length; j++) {
				this.feed.stories.push({
					title:			this.feeds.list[i].stories[j].title,
					url:			this.feeds.list[i].stories[j].url,
					summary:		this.feeds.list[i].stories[j].summary,
					date:			this.feeds.list[i].stories[j].date,
					isNew:			this.feeds.list[i].stories[j].isNew,
					isRead:			this.feeds.list[i].stories[j].isRead,
					originFeed:		i,
					originStory:	j
				});
			}
		}
	} catch(e) {
		Mojo.Log.error("error during while aggregating allItems feed", e);
	}
};

StorylistAssistant.prototype.listFind = function(filterString, listWidget, offset, count) {
	var subset = [];
	var totalSubsetSize = 0;
	var lwrFilterString = filterString.toLowerCase();
	
	for(var i = 0; i < this.feed.stories.length; i++) {
		if (this.feed.stories[i].title.toLowerCase().include(lwrFilterString)) {
			if ((subset.length < count) && (totalSubsetSize >= offset)) {
				subset.push(this.feed.stories[i]);
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

StorylistAssistant.prototype.showStory = function(event) {
	var storyIndex = this.feed.stories.indexOf(event.item);
	var story = this.feed.stories[storyIndex];
	
	if (!story.isRead) {
		if(story.originFeed) {
			this.feeds.markStoryRead(story.originFeed, story.originStory);
		} else {
			this.feeds.markStoryRead(this.feedIndex, storyIndex);
		}
		this.updateModel();
	}
	
	var viewMode = this.feed.viewMode;
	var feedIndex = this.feedIndex;
	if(story.originFeed)  {
		viewMode = this.feeds.list[story.originFeed].viewMode;
		feedIndex = story.originFeed;
	}
	
	switch(parseInt(viewMode, 10)) {
		case 0:
			this.controller.serviceRequest("palm://com.palm.applicationManager", {
				method: "open",
				parameters: {
					id: "com.palm.app.browser",
					params: {
						target: story.url
					}
				}
			});
			break;
			
		case 1:
			this.controller.stageController.pushScene("fullStory", this.feeds, this.feed, feedIndex, storyIndex);
			break;
	}
};

StorylistAssistant.prototype.handleCommand = function(event) {
	if(event.type === Mojo.Event.command) {
		switch(event.command) {
			case "do-previousFeed":
				this.controller.stageController.swapScene({
					name: "storylist",
					transition: Mojo.Transition.crossFade
				}, this.feeds, this.feedIndex - 1);
				break;
				
			case "do-nextFeed":
				this.controller.stageController.swapScene({
					name: "storylist",
					transition: Mojo.Transition.crossFade
				}, this.feeds, this.feedIndex + 1);
				break;
			
			case "do-feedUpdate":
				event.stopPropagation();
				if((this.feed.type == "allItems") ||
				   (this.feed.type == "allUnRead") ||
				   (this.feed.type == "allNew")) {
					this.feeds.update();	
				} else {
					this.feeds.updateFeed(this.feedIndex);
				}
				break;
		}
	}
};

StorylistAssistant.prototype.considerForNotification = function(params){
	if(params) {
		switch(params.type) {
			case "feed-update":
				if(this.feedIndex == params.feedIndex) {
					this.updateModel();
				}
				if(this.commandModel.items[1].disabled != this.feeds.updateInProgress) {
					this.commandModel.items[1].disabled = this.feeds.updateInProgress;
					this.controller.modelChanged(this.commandModel);
				}
				break;
		}
	}
	
	return params;
};
