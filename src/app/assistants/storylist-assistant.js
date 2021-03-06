/*
 *		app/assistants/storylist-assistant.js
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

function StorylistAssistant(feeds, feed) {
	this.feeds = feeds;
	this.feed = feed;

	this.dateConverter = this.feeds.dateConverter;

	this.filter = "dummyFilter";
	this.viewMode = feed.sortMode;
	this.commandModel = {};
	this.feedList = null;
	this.feedIndex = -1;

	this.listFindHandler = this.listFindHandler.bind(this);

	this.updateItems = this.updateItems.bind(this);
	this.setListLength = this.setListLength.bind(this);

	this.sortModeTap = this.sortModeTap.bindAsEventListener(this);
	this.sortModeChoose = this.sortModeChoose.bind(this);
	this.sendChoose = this.sendChoose.bind(this);
	this.feedDataHandler = this.feedDataHandler.bind(this);
	this.showStory = this.showStory.bindAsEventListener(this);
	this.listDataHandler = this.listDataHandler.bind(this);
	this.changeFeed = this.changeFeed.bind(this);
	this.openBrowser = this.openBrowser.bind(this);
	this.deleteStory = this.deleteStory.bind(this);

	this.setupComplete = false;
	this.wasActiveBefore = false;
	this.listRefreshNeeded = true;

	this.isFirst = true;
	this.isLast = true;
}

StorylistAssistant.prototype.setup = function() {
	SceneControl.beginSceneSetup(this, true);

	this.controller.get("feed-title").update(this.feeds.getFeedTitle(this.feed));
	this.controller.get("appIcon").className += " " + this.feeds.getFeedIconClass(this.feed, true, true);

	this.feedDataHandler(this.feed);
	this.feeds.getFeedIDList(this.listDataHandler);

	this.controller.setDefaultTransition(Mojo.Transition.defaultTransition);

    // Setup the story list.
	this.storyListWidget = this.controller.get("storyList");
	this.controller.setupWidget("storyList", {
		itemTemplate:	"storylist/storylistRowTemplate",
		listTemplate:	"storylist/storylistListTemplate",
		emptyTemplate:	"storylist/storylistEmptyTemplate",
		formatters:  {
			"date":				this.listFormatter.bind(this, "date"),
			"isRead": 			this.listFormatter.bind(this, "isRead"),
			"titleColor":		this.listFormatter.bind(this, "titleColor"),
			"contentStyle": 	this.listFormatter.bind(this, "contentStyle"),
			"title":			this.listFormatter.bind(this, "title"),
			"summary":			this.listFormatter.bind(this, "summary"),
			"origin":			this.listFormatter.bind(this, "origin"),
			"large":			this.listFormatter.bind(this, "large"),
			"starClass":		this.listFormatter.bind(this, "starClass")
		},
		swipeToDelete:	true,
		renderLimit: 	50,
		reorderable:	false,
		delay:			500,
		filterFunction: this.listFindHandler
	}, {});

	this.controller.listen("storyList", Mojo.Event.listTap, this.showStory);
    this.controller.listen("storyList", Mojo.Event.listDelete, this.deleteStory);

    this.controller.listen("sortIcon", Mojo.Event.tap, this.sortModeTap);

	// Setup command menu.
	this.initCommandModel();
    this.controller.setupWidget(Mojo.Menu.commandMenu, undefined, this.commandModel);
};

StorylistAssistant.prototype.initCommandModel = function() {
	this.commandModel.label = "";
	this.commandModel.items = [
		{
			items: [
				{
					icon: "back",
					disabled: this.isFirst,
					command: "do-previousFeed"
				},
				{
					icon: "forward",
					disabled: this.isLast,
					command: "do-nextFeed"
				}
			]
		},
		{
			items: [
				{
					icon:		"forward-email",
					command:	"do-send"
				},
				{
					icon: "refresh",
					disabled: this.feeds.isUpdating(),
					command: "do-feedUpdate"
				}
			]
		}
	];

	if(!FeedReader.prefs.leftHanded) {
		this.commandModel.items.reverse();
	}
};

StorylistAssistant.prototype.activate = function(event) {
	if(this.wasActiveBefore) {
		this.refreshList();

		if(this.feedIndex >= 0) {
			this.initCommandModel();
			this.controller.modelChanged(this.commandModel);
		}
	}
	this.wasActiveBefore = true;
};

StorylistAssistant.prototype.cleanup = function(event) {
	this.controller.stopListening("storyList", Mojo.Event.listTap, this.showStory);
	this.controller.stopListening("storyList", Mojo.Event.listDelete, this.deleteStory);
    this.controller.stopListening("sortIcon", Mojo.Event.tap, this.sortModeTap);
};

StorylistAssistant.prototype.refreshList = function() {
	this.feeds.getFeed(this.feed.id, this.feedDataHandler);
};

/* List formatters */
StorylistAssistant.prototype.listFormatter = function(attribute, property, model) {
	if(!model) {
		return {};
	}

	switch(attribute) {
		case "date":			return { date: this.dateConverter.dateToLocalTime(model.pubdate) };
		case "isRead":			return { titleStyle: property ? "normal-text" : "bold-text" };
		case "titleColor":		return { titleColor: FeedReader.prefs.titleColor };
		case "origin":			return { origin: this.feed.feedType < 0 ? "(" + model.feedTitle + ")" : "" };
		case "contentStyle":	return { contentStyle: "normal-text" };
		case "large":			return { large: FeedReader.prefs.largeFont ? "large": "" };
		case "title":			return { title: model.showCaption ? model.title : "" };
		case "starClass":		return { starClass: model.isStarred ? "starred" : "" };

		case "summary":
			if(model.showSummary) {
				var baseSummary = Formatting.stripHTML(property);
				if(baseSummary.length > (parseInt(FeedReader.prefs.summaryLength, 10) + 10)) {
					return { shortSummary: baseSummary.slice(0, parseInt(FeedReader.prefs.summaryLength, 10) - 1) + '...' };
				} else {
					return { shortSummary: baseSummary };
				}
			} else {
				return { shortSummary: "" };
			}
	}

	return {};
};

/* List related functions */
StorylistAssistant.prototype.listFindHandler = function(filterString, listWidget, offset, count) {
	if(this.feeds.isReady()) {
		if(this.filter != filterString) {
			this.filter = filterString;
			this.feeds.getStoryCount(this.feed, this.filter, this.setListLength);
		} else {
			this.feeds.getStories(this.feed, this.filter, offset, count, this.updateItems);
		}
	}
};

StorylistAssistant.prototype.listDataHandler = function(ids) {
	this.feedList = ids;

	for(var i = 0; i < this.feedList.length; i++) {
		if(this.feedList[i] == this.feed.id) {
			this.feedIndex = i;
			break;
		}
	}

	this.isFirst = this.feedIndex <= 0;
	this.isLast = this.feedIndex >= this.feedList.length - 1;

	this.initCommandModel();
	this.controller.modelChanged(this.commandModel);
};

StorylistAssistant.prototype.updateItems = function(offset, items) {
	this.storyListWidget.mojo.noticeUpdatedItems(offset, items);
	SceneControl.endSceneSetup(this);
};

StorylistAssistant.prototype.setListLength = function(count) {
	if(this.filter !== "") {
		// Stop the FilterField spinner and set the found count.
		this.storyListWidget.mojo.setCount(count);
	}
	this.storyListWidget.mojo.setLengthAndInvalidate(count);
	SceneControl.endSceneSetup(this);
};

StorylistAssistant.prototype.feedDataHandler = function(feed) {
	this.feed = feed;
	this.controller.get("new-count").update(this.feed.numNew);
	this.controller.get("unread-count").update(this.feed.numUnRead);

	this.feeds.getStoryCount(this.feed, this.filter, this.setListLength);
};

/* various event handlers */
StorylistAssistant.prototype.showStory = function(event) {
	if(event.originalEvent.target.id == "starStory") {
		// Toggle the flag.
		var item = {
			id:			event.item.id,
			isStarred:	event.item.isStarred ? 0 : 1
		};
		this.feeds.markStarred(item);
		this.refreshList();
	} else if(event.item.fullStory) {
		this.controller.stageController.pushScene("fullStory", this.feeds,
												  this.feed, event.item.id);
	} else {
		this.feeds.getStory(event.item.id, this.listStoryURLs.bind(this, event));
	}
};

StorylistAssistant.prototype.deleteStory = function(event) {
	this.feeds.deleteStory(event.item);
};

StorylistAssistant.prototype.listStoryURLs = function(event, feed, story, urls) {
	this.feeds.markStoryRead(story);
	if(urls.length == 1) {
		this.openBrowser(urls[0].href);
	} else if(urls.length > 1) {
		var subMenu = {
			onChoose:	this.openBrowser,
			placeNear:	event.target,
			items: 		[]
		};

		for(var i = 0; i < urls.length; i++) {
			subMenu.items.push({
				label:		urls[i].title,
				command:	urls[i].href
			});
		}

		this.controller.popupSubmenu(subMenu);
	}
};

StorylistAssistant.prototype.openBrowser = function(url) {
	this.controller.serviceRequest("palm://com.palm.applicationManager", {
		method: "open",
		parameters: {
			id: "com.palm.app.browser",
			params: {
				target: url
			}
		}
	});
};

StorylistAssistant.prototype.sortModeTap = function(event) {
	var subMenu = {
		onChoose:  this.sortModeChoose,
		placeNear: event.target,
		items: [
			{ label: $L("Show all items"),		command: "sort-all",	chosen: (this.feed.sortMode & 0xFF) === 0 },
			{ label: $L("Show unread items"),	command: "sort-unread",	chosen: (this.feed.sortMode & 0xFF) === 1 },
			{ label: $L("Show new items"),		command: "sort-new", 	chosen: (this.feed.sortMode & 0xFF) === 2 }
		]
	};

	if(this.feed.feedType <= 0) {
		subMenu.items.push({});
		subMenu.items.push({
			label: $L("Order by date"),			command: "sort-date",	chosen: (this.feed.sortMode & 0xFF00) == 0x0100
		});
	}

	subMenu.items.push({});
	subMenu.items.push({label: $L("Unstar all"), command: "unstar-all" });
	this.controller.popupSubmenu(subMenu);
};

StorylistAssistant.prototype.sortModeChoose = function(command) {
	var feed = new feedProto(this.feed);

	switch(command) {
		case "sort-all":
			feed.sortMode = (feed.sortMode & 0xFF00) | 0;
			break;

		case "sort-unread":
			feed.sortMode = (feed.sortMode & 0xFF00) | 1;
			break;

		case "sort-new":
			feed.sortMode = (feed.sortMode & 0xFF00) | 2;
			break;

		case "sort-date":
			feed.sortMode = feed.sortMode ^ 0x0100;
			break;

		case "unstar-all":
			this.feeds.markAllUnStarred(this.feed);
			this.refreshList();
			return;
	}
	this.feeds.setSortMode(feed);
	Mojo.Log.info("SL> setting sortMode to", feed.sortMode);
};

StorylistAssistant.prototype.doSendFeed = function(command, urls) {
	if(urls.length <= 0) {
		return;
	}

	var i = 0;
	var text = "";

	switch(command) {
		case "send-sms":
			text = $L("Check out these stories") + ': ' + urls[i].url;
			for(i = 1; i < urls.length; i++) {
				text += ', ' + urls[i].url;
			}
			FeedReader.sendSMS(text);
			break;

		case "send-email":
			for(i = 0; i < urls.length; i++) {
				text += '<li><a href="' + urls[i].url + '">' + urls[i].title + '</a></li>';
			}
			FeedReader.sendEMail($L("Check out these stories"),
								 	'<ul>' + text + '</ul>');
			break;
	}
};

StorylistAssistant.prototype.sendChoose = function(command) {
	this.feeds.getFeedURLList(this.feed, this.doSendFeed.bind(this, command));
};

StorylistAssistant.prototype.changeFeed = function(feed) {
	this.controller.stageController.swapScene({
		name: "storylist",
		transition: Mojo.Transition.crossFade
	}, this.feeds, feed);
};

StorylistAssistant.prototype.handleCommand = function(event) {
	if(event.type === Mojo.Event.command) {
		switch(event.command) {
			case "do-previousFeed":
				this.feeds.getFeed(this.feedList[this.feedIndex - 1], this.changeFeed);
				break;

			case "do-nextFeed":
				this.feeds.getFeed(this.feedList[this.feedIndex + 1], this.changeFeed);
				break;

			case "do-feedUpdate":
				event.stopPropagation();
				this.feeds.interactiveUpdate = true;
				if(this.feed.feedType < feedTypes.ftUnknown) {
					this.feeds.enqueueUpdateAll();
				} else {
					this.feeds.enqueueUpdate(this.feed);
				}
				break;

			case "do-send":
				this.controller.popupSubmenu({
					onChoose:  this.sendChoose,
					placeNear: event.originalEvent.target,
					items: [
						{ label: $L("Send via SMS/IM"),	command: "send-sms" },
						{ label: $L("Send via E-Mail"),	command: "send-email" }
					]
				});
				break;
		}
	}
};

StorylistAssistant.prototype.considerForNotification = function(params){
	if(params) {
		switch(params.type) {
			case "feed-update":
				Mojo.Log.info("SL> feed update received");
				if(this.feed.feedOrder == params.feedOrder) {
					this.refreshList();
					Mojo.Log.info("SL> refreshing list");
				}
				break;

			case "storylist-changed":
				Mojo.Log.info("SL> story list update received; refreshing list");
				this.refreshList();
				break;

			case "updatestate-changed":
				this.initCommandModel();
				this.controller.modelChanged(this.commandModel);
				break;

			case "app-activate":
				Mojo.Log.info("STORYLIST> App re-activated; updating display");
				this.activate();
				break;
		}
	}

	return params;
};
