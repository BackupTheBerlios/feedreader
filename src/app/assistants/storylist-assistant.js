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

function StorylistAssistant(feeds, index) {
	this.feeds = feeds;
	this.feedIndex = index;
	
	this.feed = this.feeds.list[index];
	this.filter = "";
	
	this.listFormatterHandler = this.listFormatter.bind(this);
	this.listFindHandler = this.listFind.bind(this);
}

StorylistAssistant.prototype.setup = function() {
	// Setup application menu.
	this.controller.setupWidget(Mojo.Menu.appMenu, FeedReader.menuAttr, FeedReader.menuModel);

    // Setup the story list.
	this.controller.setupWidget("storyList", {
		itemTemplate:	"storylist/storylistRowTemplate", 
		listTemplate:	"storylist/storylistListTemplate", 
		formatters:  { 
			"titleStyle": 		this.listFormatterHandler,
			"titleColor":		this.listFormatterHandler,
			"contentStyle": 	this.listFormatterHandler
		},
		swipeToDelete:	false, 
		renderLimit: 	40,
		reorderable:	false,
		delay:			700,
		filterFunction: this.listFindHandler
	},
	this.storyListModel = {
		items: this.feed.stories
	});
	
	// Setup command menu.
    this.controller.setupWidget(Mojo.Menu.commandMenu, undefined, this.updateModel = {
		label: "",
        items: [
            { icon: "refresh", disabled: this.feeds.updateInProgress, command: "do-feedUpdate" }
        ]
	});

    this.controller.listen("storyList", Mojo.Event.listTap,
        				   this.showStory.bindAsEventListener(this));
	this.controller.get("feed-title").update(this.feed.title);
};

StorylistAssistant.prototype.activate = function(event) {
	this.controller.modelChanged(this.storyListModel);
};

StorylistAssistant.prototype.deactivate = function(event) {
	this.feeds.markSeen(this.feedIndex);
	this.feeds.save();
};

StorylistAssistant.prototype.cleanup = function(event) {
};

StorylistAssistant.prototype.listFormatter = function(property, model) {
	model.titleStyle = model.isRead ? "normal-text" : "bold-text";
	model.titleColor = FeedReader.prefs.titleColor;
	model.contentStyle = "normal-text";
	if(model.summary) {
		if(model.summary.length > (FeedReader.prefs.summaryLength + 10)) {
			model.shortSummary = model.summary.slice(0, FeedReader.prefs.summaryLength - 1) + '...';
		} else {
			model.shortSummary = model.summary;
		}
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
	if (!this.feed.stories[event.index].isRead) {
		this.feeds.markStoryRead(this.feedIndex, event.index);
		this.storyListModel.items = this.feed.stories;
		this.controller.modelChanged(this.storyListModel);
		this.feeds.save();
	}
	
	switch(parseInt(this.feed.viewMode, 10)) {
		case 0:
			this.controller.serviceRequest("palm://com.palm.applicationManager", {
				method: "open",
				parameters: {
					id: "com.palm.app.browser",
					params: {
						target: this.feed.stories[event.index].url
					}
				}
			});
			break;

		case 1:
			this.controller.stageController.pushScene("fullStory", this.feeds,
													  this.feedIndex, event.index);
			break;
	}
};

StorylistAssistant.prototype.handleCommand = function(event) {
	if(event.type === Mojo.Event.command) {
		switch(event.command) {
			case "do-feedUpdate":
				event.stopPropagation();
				this.feeds.updateFeed(this.feedIndex);
				break;
		}
	}
};

StorylistAssistant.prototype.considerForNotification = function(params){
	if(params) {
		switch(params.type) {
			case "feed-update":
				if(this.feedIndex == params.feedIndex) {
					this.storyListModel.items = this.feed.stories;
					this.controller.modelChanged(this.storyListModel);
				}
				if(this.updateModel.items[0].disabled != this.feeds.updateInProgress) {
					this.updateModel.items[0].disabled = this.feeds.updateInProgress;
					this.controller.modelChanged(this.updateModel);
				}
				break;
		}
	}
	
	return params;
};
