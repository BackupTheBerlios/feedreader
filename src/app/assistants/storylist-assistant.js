/*
 *		app/assistants/storylist-assistant.js
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

function StorylistAssistant(feeds, index) {
	this.feeds = feeds;
	this.feedIndex = index;
	this.feed = this.feeds.list[index];
	
	this.dateConverter = this.feeds.dateConverter;
	
	this.isAllItems = (this.feed.type == "allItems");
	this.filter = "";	// No filter.
	this.viewMode = 0;	// Show all items.
	this.commandModel = {};
	
	this.listFindHandler = this.listFind.bind(this);
	this.sortModeTapHandler = this.sortModeTap.bindAsEventListener(this);
	this.sortModeChooseHandler = this.sortModeChoose.bind(this);
	
	this.setupComplete = false;
	this.wasActiveBefore = false;
	this.listRefreshNeeded = true;	
}

StorylistAssistant.prototype.setup = function() {
	FeedReader.beginSceneSetup(this, true);

	this.controller.get("feed-title").update(this.feeds.getFeedTitle(this.feed));
	this.controller.get("appIcon").className += " " + this.feeds.getFeedHeaderIcon(this.feed);

	this.controller.setDefaultTransition(Mojo.Transition.defaultTransition);

    // Setup the story list.
	this.storyListWidget = this.controller.get("storyList");
	this.controller.setupWidget("storyList", {
		itemTemplate:	"storylist/storylistRowTemplate", 
		listTemplate:	"storylist/storylistListTemplate", 
		formatters:  {
			"date":				this.getDate.bind(this),
			"isRead": 			this.getTitleStyle.bind(this),
			"titleColor":		this.getTitleColor.bind(this),
			"contentStyle": 	this.getContentStyle.bind(this),
			"title":			this.getTitle.bind(this),
			"summary":			this.getSummary.bind(this),
			"origin":			this.getOrigin.bind(this),
			"large":			this.getLargeFont.bind(this)
		},
		swipeToDelete:	false, 
		renderLimit: 	100,
		reorderable:	false,
		delay:			700,
		filterFunction: this.listFindHandler
	}, {});
	
	this.controller.listen("storyList", Mojo.Event.listTap,
					       this.showStory.bindAsEventListener(this));
    this.controller.listen("sortIcon", Mojo.Event.tap, this.sortModeTapHandler);

	// Setup command menu.
	this.initCommandModel();
    this.controller.setupWidget(Mojo.Menu.commandMenu, undefined, this.commandModel);
	
	this.setupComplete = true;
	FeedReader.endSceneSetup(this);
};

StorylistAssistant.prototype.initCommandModel = function() {
	this.commandModel.label = "";
	this.commandModel.items = [
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
	];
	
	if(!FeedReader.prefs.leftHanded) {
		this.commandModel.items.reverse();
	}
};

StorylistAssistant.prototype.activate = function(event) {
	if(this.wasActiveBefore) {
		this.listRefreshNeeded = this.listRefreshNeeded || (this.feed.sortMode !== 0);
		this.storyListWidget.mojo.setLengthAndInvalidate(this.feeds.getFeedLength(this.feedIndex));
		this.initCommandModel();
		this.controller.modelChanged(this.commandModel);
	}
	this.wasActiveBefore = true;
};

StorylistAssistant.prototype.deactivate = function(event) {
};

StorylistAssistant.prototype.cleanup = function(event) {
	this.feeds.markSeen(this.feedIndex);
};

/* List formatters */
StorylistAssistant.prototype.getDate = function(property, model) {
	return { date: this.dateConverter.dateToLocalTime(model.intDate) };
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
	if((!this.isAllItems) || (model === undefined) || (model === null) ||
	   (model.index === undefined) || (model.index === null)) {
		return undefined;
	}

	var origin = this.feeds.getStoryOrigin(this.feedIndex, model.index);
	return { origin: "(" + this.feeds.list[origin.feedIndex].title + ")" };
};

StorylistAssistant.prototype.getSummary = function(property, model) {
	if(!property) {
		return undefined;
	} else {
		if(this.isAllItems) {
			var origin = this.feeds.getStoryOrigin(this.feedIndex, model.index);
			if(!this.feeds.showSummary(this.feeds.list[origin.feedIndex], false)) {
				return { shortSummary: "" };				
			}
		} else {
			if(!this.feeds.showSummary(this.feed, false)) {
				return { shortSummary: "" };
			}
		}
		
		if(property.length > (parseInt(FeedReader.prefs.summaryLength, 10) + 10)) {
			return { shortSummary: property.slice(0, parseInt(FeedReader.prefs.summaryLength, 10) - 1) + '...' };
		} else {
			return { shortSummary: property };
		}
	}	
};

StorylistAssistant.prototype.getTitle = function(property, model) {
	if(!property) {
		return undefined;
	} else {
		if(this.isAllItems) {
			var origin = this.feeds.getStoryOrigin(this.feedIndex, model.index);
			if(!this.feeds.showCaption(this.feeds.list[origin.feedIndex], false)) {
				return { title: "" };				
			}
		} else {
			if(!this.feeds.showCaption(this.feed, false)) {
				return { title : "" };
			}
		}
		return { title: model.title };
	}	
};

StorylistAssistant.prototype.getLargeFont = function(property, model) {
	return { large: FeedReader.prefs.largeFont ? "large": "" };
};

/* Other list related functions */
StorylistAssistant.prototype.listFind = function(filterString, listWidget, offset, count) {
	var subset = [];
	var subsetSize = 0;
	var totalSubsetSize = 0;
	
	var lwrFilterString = filterString.toLowerCase();
	var feedLength = this.feeds.getFeedLength(this.feedIndex);
	this.listRefreshNeeded = this.listRefreshNeeded || (this.filter != filterString);
	
	var stories = [];	
	var origin = {};
	var feeds = this.feeds.list;
	var matches = false;
	
	try {
		for(var i = 0; i < feedLength; i++) {
			origin = this.feeds.getStoryOrigin(this.feedIndex, i);
			stories = feeds[origin.feedIndex].stories;
			
			matches = (lwrFilterString.length === 0) ||
					  (stories[origin.storyIndex].title.toLowerCase().include(lwrFilterString));
			
			if(matches) {
				stories[origin.storyIndex].index = totalSubsetSize;
				if((subsetSize < count) && (totalSubsetSize >= offset)) {
					subsetSize++;
					subset.push(stories[origin.storyIndex]);
				}
				totalSubsetSize++;
				if(!this.listRefreshNeeded && (subsetSize == count)) {
					break;
				}
			}
		}
	} catch(e) {
		Mojo.Log.logException(e);
		Mojo.Log.logProperties(origin);
		Mojo.Log.error("The index was", i);
	}

	if(this.listRefreshNeeded) {
		this.listRefreshNeeded = false;
		Mojo.Log.info("Total subset length is", totalSubsetSize);
		listWidget.mojo.setLength(totalSubsetSize);
		listWidget.mojo.noticeUpdatedItems(offset, subset);	
		this.filter = filterString;
	}
};

/* various event handlers */
StorylistAssistant.prototype.showStory = function(event) {
	var storyIndex = event.item.index;
	var origin = this.feeds.getStoryOrigin(this.feedIndex, storyIndex);
	var story = this.feeds.list[origin.feedIndex].stories[origin.storyIndex];
	
	switch((parseInt(this.feeds.list[origin.feedIndex].viewMode, 10) & 0xFFFF)) {
		case 0:
			if (!story.isRead) {
				this.feeds.markStoryRead(origin.feedIndex, origin.storyIndex);
			}
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
			this.controller.stageController.pushScene("fullStory", this.feeds,
													  this.feedIndex, storyIndex);
			break;
	}
};

StorylistAssistant.prototype.sortModeTap = function(event) {
	var findPlace = event.target;

	this.controller.popupSubmenu({
	  onChoose:  this.sortModeChooseHandler,
	  placeNear: findPlace,
	  items: [
		{ label: $L("Show all items"),		command: "sort-all",	chosen: this.feed.sortMode === 0 },
		{ label: $L("Show unread items"),	command: "sort-unread",	chosen: this.feed.sortMode === 1 }
		]
	  });
};

StorylistAssistant.prototype.sortModeChoose = function(command) {
	switch(command) {
		case "sort-all":
			this.feed.sortMode = 0;
			break;
			
		case "sort-unread":
			this.feed.sortMode = 1;
			break;
			
		case "sort-new":
			this.feed.sortMode = 2;
			break;
	}
	
	this.listRefreshNeeded = true;
	this.storyListWidget.mojo.setLengthAndInvalidate(this.feeds.getFeedLength(this.feedIndex));
	this.feeds.save();
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
				if(this.feed.type == "allItems") {
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
					this.listRefreshNeeded = true;
					this.storyListWidget.mojo.setLengthAndInvalidate(this.feeds.getFeedLength(this.feedIndex));
				}
				this.initCommandModel();
				this.controller.modelChanged(this.commandModel);
				break;
			
			case "jslint-dummy":
				break;
		}
	}
	
	return params;
};
