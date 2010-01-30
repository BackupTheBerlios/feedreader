/*
 *		app/assistants/fullStory-assistant.js
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

function FullStoryAssistant(feeds, feed, feedIndex, storyIndex) {
	this.feeds = feeds;
	this.feed = feed;
	this.story = this.feed.stories[storyIndex];
	this.storyIndex = storyIndex;
	this.feedIndex = feedIndex;
	
	if(this.story.originFeed) {
		this.originFeed = this.story.originFeed;
		this.originStory = this.story.originStory;
	} else {
		this.originFeed = this.feedIndex;
		this.originStory = this.storyIndex;
	}
	
	this.feeds.markStoryRead(this.originFeed, this.originStory);
}

FullStoryAssistant.prototype.setup = function() {
	// Setup application menu.
	this.controller.setupWidget(Mojo.Menu.appMenu, FeedReader.menuAttr, FeedReader.menuModel);

	this.controller.get("appIcon").className += " " + this.feeds.getFeedHeaderIcon(this.feed);
	this.controller.get("feed-title").update(this.feeds.getFeedTitle(this.feeds.list[this.originFeed]));
	this.controller.get("story-date").update(this.story.date);
	this.controller.get("story-title").update(this.story.title);
	this.controller.get("story-content").update(this.story.summary);

	this.controller.get("story-title").className = "story-title bold-text multiline " + FeedReader.prefs.titleColor;
	
	// Setup command menu.
    this.controller.setupWidget(Mojo.Menu.commandMenu, undefined, this.commandModel = {
		label: "",
        items: [
			{
				items: [
					{
						icon: "back",
						disabled: this.storyIndex === 0,
						command: "do-previousStory"
					},
					{
						icon: "forward",
						disabled: this.storyIndex === (this.feed.stories.length - 1),
						command: "do-nextStory"
					}
				]
			}
        ]
	});

    this.controller.listen("fullStory", Mojo.Event.tap,
        				   this.storyTap.bindAsEventListener(this));
	
	this.feeds.save();
};

FullStoryAssistant.prototype.activate = function(event) {
	this.controller.get("story-title").className = "story-title bold-text multiline " + FeedReader.prefs.titleColor;
};


FullStoryAssistant.prototype.deactivate = function(event) {
	this.feeds.save();
};

FullStoryAssistant.prototype.cleanup = function(event) {
};

FullStoryAssistant.prototype.storyTap = function(event) {
	this.controller.serviceRequest("palm://com.palm.applicationManager", {
		method: "open",
		parameters: {
			id: "com.palm.app.browser",
			params: {
				target: this.story.url
			}
		}
	});
};

FullStoryAssistant.prototype.handleCommand = function(event) {
	if(event.type === Mojo.Event.command) {
		switch(event.command) {
			case "do-previousStory":
				this.controller.stageController.swapScene({
					name: "fullStory",
					transition: Mojo.Transition.crossFade
				}, this.feeds, this.feed, this.feedIndex, this.storyIndex - 1);
				break;
				
			case "do-nextStory":
				this.controller.stageController.swapScene({
					name: "fullStory",
					transition: Mojo.Transition.crossFade
				}, this.feeds, this.feed, this.feedIndex, this.storyIndex + 1);
				break;
		}
	}
};