/*
 *		app/assistants/fullStory-assistant.js
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

var mediaModes = {
	mdNoMedia:	0,
	mdAudio:	1,
	mdVideo:	2
};

function FullStoryAssistant(feeds, feed, storyID) {
	Mojo.Log.info("FULLSTORY> loading story", storyID);
	this.feeds = feeds;
	this.feed = feed;
	this.storyID = storyID;

	this.setupComplete = false;
	this.commandModel = {
		label:	"",
		items:	[]
	};
	this.media = null;
	this.mediaExtension = null;
	this.mediaReady = false;
	this.playState = 0;
	this.seeking = false;
	this.pictureSpinner = null;
	this.storyList = null;
	this.storyIndex = -1;
	this.isFirst = true;
	this.isLast = true;

	this.mouseDown = false;
	this.scrolling = false;

	/* pre bind handlers */
	this.startSeeking = this.startSeeking.bindAsEventListener(this);
	this.doSeek = this.doSeek.bindAsEventListener(this);
	this.stopSeeking = this.stopSeeking.bindAsEventListener(this);
	this.sendChoose = this.sendChoose.bind(this);

	this.storyTap = this.storyTap.bindAsEventListener(this);
	this.openURL = this.openURL.bind(this);
	this.pictureLoaded = this.pictureLoaded.bind(this);
	this.starIconTap = this.starIconTap.bindAsEventListener(this);

	this.dataHandler = this.dataHandler.bind(this);
	this.listDataHandler = this.listDataHandler.bind(this);
	this.feedDataHandler = this.feedDataHandler.bind(this);
	this.storyUpdate = this.storyUpdate.bind(this);

	this.handleClick = this.handleClick.bindAsEventListener(this);
	this.handleMouseDown = this.handleMouseDown.bindAsEventListener(this);
	this.handleMouseUp = this.handleMouseUp.bindAsEventListener(this);
	this.handleMouseMove = this.handleMouseMove.bindAsEventListener(this);

	this.mediaProgressModel = {
		progressStart: 0,
		progressEnd: 0,
		value: 0,
		minValue: 0,
		maxValue: 1000,
		disabled: true
	};
}

FullStoryAssistant.prototype.setup = function() {
	SceneControl.beginSceneSetup(this, true);

	// Set the default transition.
	this.controller.setDefaultTransition(Mojo.Transition.defaultTransition);

	// The controls should be intialized even if no audio is to be played
	// as Mojo will log a warning otherwise.
	this.controller.setupWidget("media-progress",{
		sliderProperty: "value",
		round: true,
		updateInterval: 0.2
	}, this.mediaProgressModel);
	this.controller.listen("media-progress", Mojo.Event.propertyChange, this.doSeek);
	this.controller.listen("media-progress", Mojo.Event.sliderDragStart, this.startSeeking);
	this.controller.listen("media-progress", Mojo.Event.sliderDragEnd, this.stopSeeking);

	// Setup the picture spinner.
	this.pictureSpinner = this.controller.get("picture-spinner");
	this.controller.setupWidget("picture-spinner",
								{ spinnerSize: "small" },
								{ spinning: false });
    this.controller.listen("starIcon", Mojo.Event.tap, this.starIconTap);

	// Handle a story click.
    this.controller.listen("followLink", Mojo.Event.tap, this.storyTap);
	this.controller.listen("story-content", Mojo.Event.tap, this.handleClick);
    this.controller.setupWidget(Mojo.Menu.commandMenu, undefined, this.commandModel);

	this.refreshAll();
};

FullStoryAssistant.prototype.dataHandler = function(feed, story, urls) {
	try {
		Mojo.Log.info("FULLSTORY> data now available");
		this.originFeed = feed;
		this.story = story;
		this.urls = urls;

		this.doShowMedia = this.originFeed.showMedia &&
						   ((this.story.audio.length > 0) ||
							(this.story.video.length > 0));
		this.doShowPicture = this.originFeed.showPicture;

		if(this.doShowMedia) {
			this.mediaCanPlay = this.mediaCanPlay.bind(this);
			this.mediaPlaying = this.mediaPlaying.bind(this);
			this.mediaSeeking = this.mediaSeeking.bind(this);
			this.mediaSeeked = this.mediaSeeked.bind(this);
			this.mediaStopped = this.mediaStopped.bind(this);
			this.mediaError = this.mediaError.bind(this);
			this.mediaProgress = this.mediaProgress.bind(this);
		}

		if(this.story.video.length > 0) {
			this.mediaURL = this.story.video;
			this.mediaMode = mediaModes.mdAudio;
		} else if(this.story.audio.length > 0) {
			this.mediaURL = this.story.audio;
			this.mediaMode = mediaModes.mdAudio;
		} else {
			this.mediaURL = "";
			this.mediaMode = mediaModes.mdNoMedia;
		}

		var video = null;
		this.controller.get("appIcon").className += " " + this.feeds.getFeedIconClass(this.feed, true, true);
		this.controller.get("feed-title").update(this.feeds.getFeedTitle(this.feed));

		var date = this.feeds.dateConverter.dateToLocalTime(this.story.pubdate);
		if(this.feed.feedType < feedTypes.ftUnknown) {
			date += ' (' + this.originFeed.title + ')';
		}
		this.controller.get("story-date").update(date);

		if(this.urls.length > 1) {
			this.controller.get("followLink-title").update($L("Web links"));
		} else {
			this.controller.get("followLink-title").update($L("Open Web link"));
		}

		if(this.originFeed.showDetailCaption) {
			this.controller.get("story-title").update(this.story.title);
			this.controller.listen("story-title", Mojo.Event.tap, this.storyTap);
		}

		if(this.originFeed.showDetailSummary) {
			if(this.originFeed.allowHTML) {
				this.controller.get("story-content").update(this.story.summary);
			} else {
				this.controller.get("story-content").update(Formatting.stripHTML(this.story.summary));
			}

			this.prependHyperLinks(this.controller.get("story-content"));
		}

		// Setup the story's picture.
		if(this.doShowPicture && (this.story.picture.length > 0)) {
			Mojo.Log.info("FULLSTORY> item has picture:", this.story.picture);
			this.pictureSpinner.mojo.start();
			this.controller.get("story-picture").src = this.story.picture;
			this.controller.get("story-picture").onload = this.pictureLoaded;
		} else {
			this.controller.get("img-container").hide();
		}

		// Setup player controls.
		if(this.mediaMode == mediaModes.mdVideo) {
			// Re-order the DOM nodes.
			var wrapper = this.controller.get("media-controls-wrapper");
			var content = this.controller.get("fullStoryScene");
			video = this.controller.get("media-video");
			content.appendChild(video);
			content.appendChild(wrapper);
			wrapper.className = "video";
		}

		if(!this.doShowMedia) {
			// Hide the player.
			this.controller.get("media-controls-wrapper").hide();

			// Remove the video element.
			video = this.controller.get("media-video");
			video.parentNode.removeChild(video);
		} else {
			// Load the extension library.
			var mediaExtensionLib = FeedReader.getMediaExtensionLib().mediaextension;

			// Setup media player.
			switch(this.mediaMode) {
				case mediaModes.mdAudio:
					this.media = new Audio();
					// Remove the video element.
					video = this.controller.get("media-video");
					video.parentNode.removeChild(video);
					break;

				case mediaModes.mdAudio:
					this.media = this.controller.get("media-video");
					this.controller.listen("media-video", Mojo.Event.tap, this.storyTap);
					break;
			}

			if(mediaExtensionLib && mediaExtensionLib.MediaExtension) {
				this.mediaExtension = mediaExtensionLib.MediaExtension.getInstance(this.media);
				this.mediaExtension.audioClass = "media";
			} else {
				Mojo.Log.warn("FULLSTORY> media extension is not available");
			}

			this.media.autoPlay = false;
			this.media.addEventListener("canplay", this.mediaCanPlay, false);
			this.media.addEventListener("play", this.mediaPlaying, false);
			this.media.addEventListener("seeking", this.mediaSeeking, false);
			this.media.addEventListener("seeked", this.mediaSeeked, false);
			this.media.addEventListener("abort", this.mediaStopped, false);
			this.media.addEventListener("ended", this.mediaStopped, false);
			this.media.addEventListener("error", this.mediaError, false);
			this.controller.get("media-playState").update($L("Waiting for data"));
			this.media.src = this.mediaURL;
			this.media.load();
		}

		// Setup story view.
		this.controller.get("story-title").className += " " + FeedReader.prefs.titleColor + (FeedReader.prefs.largeFont ? " large" : "");
		this.controller.get("story-content").className += (FeedReader.prefs.largeFont ? " large" : "");

		if(this.mediaMode == mediaModes.mdVideo) {
			var header = this.controller.get("page-header");
			header.parentNode.removeChild(header);
			var fade = this.controller.get("top-fade");
			fade.parentNode.removeChild(fade);
			this.controller.get("scene-main").hide();
			this.controller.hideWidgetContainer("scene-main");
		}

		this.controller.get("starIcon").className = "right" + (this.story.isStarred ? " starred" : "");

		if(this.urls.length <= 0) {
			this.controller.get("weblink-group").hide();
		}

		this.feedDataHandler(this.feed);
		if(this.ids) {
			this.listDataHandler(this.ids);
		}
	} catch(e) {
		Mojo.Log.logException(e, "FULLSTORY>");
	}
	SceneControl.endSceneSetup(this);
};

FullStoryAssistant.prototype.prependHyperLinks = function(node) {
	if(!node) {
		return;
	}

	try {
		if((node.nodeName == 'A') && node.href && (!node.href.match(/javascript.*/))) {
			node.onclick = this.handleClick.bind(this, node.href);
			node.href = 'javascript:void(0)';
		}

		for(var i = 0; i < node.childNodes.length; i++) {
			this.prependHyperLinks(node.childNodes[i]);
		}
	} catch(e) {
		Mojo.Log.logException(e);
	}
};

FullStoryAssistant.prototype.listDataHandler = function(ids) {
	this.storyList = ids;

	if(this.story) {
		this.storyIndex = -1;
		for(var i = 0; i < this.storyList.length; i++) {
			if(this.storyList[i] == this.storyID) {
				this.storyIndex = i;
				break;
			}
		}
		this.isFirst = this.storyIndex <= 0;
		this.isLast = this.storyIndex >= this.storyList.length - 1;

		// Setup command menu.
		this.initCommandModel();
		this.controller.modelChanged(this.commandModel);
	}
};

FullStoryAssistant.prototype.feedDataHandler = function(feed) {
	this.feed = feed;

	if(this.story) {
		var unReadCount = this.feed.numUnRead - (this.story.isRead ? 0 : 1);
		var newCount = this.feed.numNew - (this.story.isNew ? 1 : 0);
		this.controller.get("new-count").update(newCount);
		this.controller.get("unread-count").update(unReadCount);
	}
};

FullStoryAssistant.prototype.activate = function(event) {
	if(this.setupComplete) {
		if(this.storyList) {
			this.initCommandModel();
			this.controller.modelChanged(this.commandModel);
		}
	}

	this.feeds.getStoryIDList(this.feed, this.listDataHandler);

	Mojo.Event.listen(this.controller.stageController.document,
					  'mousedown', this.handleMouseDown);
	Mojo.Event.listen(this.controller.stageController.document,
					  'mouseup', this.handleMouseUp);
	Mojo.Event.listen(this.controller.stageController.document,
					  'mousemove', this.handleMouseMove);
};

FullStoryAssistant.prototype.deactivate = function(event) {
	Mojo.Event.stopListening(this.controller.stageController.document,
							 'mousedown', this.handleMouseDown);
	Mojo.Event.stopListening(this.controller.stageController.document,
							 'mouseup', this.handleMouseUp);
	Mojo.Event.stopListening(this.controller.stageController.document,
							 'mousemove', this.handleMouseMove);
};

FullStoryAssistant.prototype.cleanup = function(event) {
	if(this.media) {
		this.media.removeEventListener("canplay", this.mediaCanPlay);
		this.media.removeEventListener("play", this.mediaPlaying);
		this.media.removeEventListener("seeking", this.mediaSeeking);
		this.media.removeEventListener("seeked", this.mediaSeeked);
		this.media.removeEventListener("abort", this.mediaStopped);
		this.media.removeEventListener("ended", this.mediaStopped);
		this.media.removeEventListener("error", this.mediaError);
		try {
			this.setMediaTimer(false);
			this.media.src = "";
			this.media.load();
		} catch(e) {
		}
		delete this.mediaExtension;
		delete this.media;
	}
	if(!this.story.isRead) {
		this.feeds.markStoryRead(this.story);
	}

	this.controller.stopListening("media-progress", Mojo.Event.propertyChange, this.doSeek);
	this.controller.stopListening("media-progress", Mojo.Event.sliderDragStart, this.startSeeking);
	this.controller.stopListening("media-progress", Mojo.Event.sliderDragEnd, this.stopSeeking);
    this.controller.stopListening("starIcon", Mojo.Event.tap, this.starIconTap);
    this.controller.stopListening("followLink", Mojo.Event.tap, this.storyTap);
	this.controller.stopListening("story-content", Mojo.Event.tap, this.handleClick);
};

FullStoryAssistant.prototype.refreshAll = function() {
	try {
		Mojo.Log.info("FULLSTORY> refreshing data for story", this.storyID);
		this.feeds.getStory(this.storyID, this.dataHandler);
		this.feeds.getStoryIDList(this.feed, this.listDataHandler);
		this.feeds.getFeed(this.feed.id, this.feedDataHandler);
	} catch(e) {
		Mojo.Log.logException(e, "FULLSTORY>");
	}
};

FullStoryAssistant.prototype.initCommandModel = function() {
	this.commandModel.items.splice(0, this.commandModel.items.length);
    this.commandModel.items.push({
		items: [{
			icon: "back",
			disabled: this.isFirst,
			command: "do-previousStory"
		}, {
			icon: "delete",
			command: "do-deleteStory"
		}, {
			icon: "forward",
			disabled: this.isLast,
			command: "do-nextStory"
		}]
	});

	if(this.doShowMedia) {
		this.commandModel.items.push({
			items :[{
				icon: "forward-email",
				command: "do-send"
			}, {
				iconPath: "images/player/icon-play.png",
				command: "do-togglePlay",
				disabled: !this.mediaReady
			}, {
				icon: "stop",
				command: "do-stop",
				disabled: !this.mediaReady
			}]
		});

		switch(this.playState) {
			case 0:	// stopped
				this.commandModel.items[1].items[1].iconPath = "images/player/icon-play.png";
				this.commandModel.items[1].items[2].disabled = true;
				break;

			case 1:	// playing
				this.commandModel.items[1].items[1].iconPath = "images/player/icon-pause.png";
				break;

			case 2:	// paused
				this.commandModel.items[1].items[1].iconPath = "images/player/icon-play.png";
				break;
		}
	} else {
		this.commandModel.items.push({
			icon: "forward-email",
			command: "do-send"
		});
	}

	if(!FeedReader.prefs.leftHanded) {
		this.commandModel.items.reverse();
	}
};

FullStoryAssistant.prototype.pictureLoaded = function() {
	this.pictureSpinner.mojo.stop();
};

FullStoryAssistant.prototype.mediaCanPlay = function() {
	Mojo.Log.info("MEDIA> media can play");
	this.mediaReady = true;
	this.updateMediaUI();
};

FullStoryAssistant.prototype.mediaPlaying = function() {
	Mojo.Log.info("MEDIA> media playing");
	this.mediaReady = true;
	this.playState = 1;
	this.updateMediaUI();
};

FullStoryAssistant.prototype.mediaSeeking = function() {
	Mojo.Log.info("MEDIA> media seeking");
	this.controller.get("media-playState").update($L("Seeking"));
};

FullStoryAssistant.prototype.mediaSeeked = function() {
	Mojo.Log.info("MEDIA> media seeked");
	this.updateMediaUI();
};

FullStoryAssistant.prototype.mediaStopped = function() {
	Mojo.Log.info("MEDIA> media stopped");
	this.playState = 0;
	this.currentTime = 0;
	this.updateMediaUI();
};

FullStoryAssistant.prototype.mediaError = function() {
	Mojo.Log.info("MEDIA> media error");
	this.playState = 0;
	this.updateMediaUI();
	this.controller.get("media-playState").update($L("Media error"));
};

FullStoryAssistant.prototype.mediaProgress = function() {
	if(!this.seeking) {
		var buffered = this.media.buffered;
		if ((buffered !== undefined) && (buffered !== null)) {
			this.mediaProgressModel.progressStart = buffered.start(0) / this.media.duration;
			this.mediaProgressModel.progressEnd = buffered.end(0) / this.media.duration;
		}
		this.mediaProgressModel.value = Math.ceil((this.media.currentTime / this.media.duration) * 1000);
		this.controller.modelChanged(this.mediaProgressModel);
	}
	this.controller.get("media-currentPos").update(this.feeds.dateConverter.formatTimeString(Math.min(this.media.currentTime, 60039)));
	this.controller.get("media-duration").update(this.feeds.dateConverter.formatTimeString(Math.min(this.media.duration, 60039)));
};

FullStoryAssistant.prototype.togglePlay = function() {
	if(!this.mediaReady) {
		return;
	}

	try {
		switch(this.playState) {
			case 0:		// stopped --> play
				// Override the state and menu temporarely, so the
				// user does not click on click twice.
				// Once the media is playing, this will be changed automatically.
				this.controller.get("media-playState").update($L("Starting playback"));
				this.mediaReady = false;
				this.initCommandModel();
				this.controller.modelChanged(this.commandModel);
				this.media.play();
				break;

			case 1:		// playing --> pause
				this.media.pause();
				this.playState = 2;
				this.updateMediaUI();
				this.setMediaTimer(false);
				break;

			case 2:		// paused --> play
				this.media.play();
				break;
		}
	} catch(e) {
		Mojo.Log.logException(e);
	}
};

FullStoryAssistant.prototype.stopMedia = function() {
	if(this.playState !== 0) {
		this.media.pause();
		this.media.currentTime = 0;
		this.playState = 0;
		this.setMediaTimer(false);
		this.updateMediaUI();
	}
};

FullStoryAssistant.prototype.startSeeking = function(event) {
	if(!this.mediaReady || (this.playState === 0)) {
		return;
	}

	this.media.pause();
	this.setMediaTimer(false);
	this.seeking = true;
};

FullStoryAssistant.prototype.doSeek = function(event) {
	if(!this.mediaReady || (this.playState === 0)) {
		return;
	}
	this.media.currentTime = (event.value * this.media.duration) / 1000;
	this.mediaProgress();
};

FullStoryAssistant.prototype.stopSeeking = function(event) {
	this.seeking = false;
	this.media.play();
	this.setMediaTimer(true);
};

FullStoryAssistant.prototype.setMediaTimer = function(active) {
	if(active && (this.playState == 1)) {
		if(!this.timer) {
			this.timer = this.controller.window.setInterval(this.mediaProgress, 200);
		}
	} else if(this.timer) {
		this.controller.window.clearInterval(this.timer);
		this.timer = undefined;
	}
};

FullStoryAssistant.prototype.updateMediaUI = function() {
	if(!this.mediaReady || (this.playState === 0)) {
		this.mediaProgressModel.progress = 0;
		this.mediaProgressModel.value = 0;
		this.mediaProgressModel.disabled = true;
		this.controller.modelChanged(this.mediaProgressModel);
	} else if(this.mediaProgressModel.disabled) {
		this.mediaProgressModel.disabled = false;
		this.controller.modelChanged(this.mediaProgressModel);
	}

	switch(this.playState) {
		case 0:	// stopped
			this.controller.get("media-playState").update($L("Stopped"));
			this.controller.get("media-currentPos").update(this.feeds.dateConverter.formatTimeString(0));
			this.controller.get("media-duration").update(this.feeds.dateConverter.formatTimeString(0));
			this.mediaProgressModel.progressStart = 0;
			this.mediaProgressModel.progressEnd = 0;
			break;

		case 1:	// playing
			this.controller.get("media-playState").update($L("Playing"));
			break;

		case 2:	// paused
			this.controller.get("media-playState").update($L("Paused"));
			break;
	}
	this.initCommandModel();
	this.controller.modelChanged(this.commandModel);

	this.setMediaTimer(true);
};

FullStoryAssistant.prototype.storyTap = function(event) {
	if(this.urls.length == 1) {
		this.openURL(this.urls[0].href);
	} else if(this.urls.length > 1) {
		var subMenu = {
			onChoose:  this.openURL,
			placeNear: event.target,
			items: []
		};
		for(var i = 0; i < this.urls.length; i++) {
			subMenu.items.push({
				label:		this.urls[i].title,
				command:	this.urls[i].href
			});
		}

		this.controller.popupSubmenu(subMenu);
	}
};

FullStoryAssistant.prototype.storyUpdate = function(feed, story, urls) {
	this.story = story;
	this.controller.get("starIcon").className = "right" + (this.story.isStarred ? " starred" : "");
};

FullStoryAssistant.prototype.starIconTap = function(event) {
	// Toggle the flag.
	var item = {
		id:			this.story.id,
		isStarred:	this.story.isStarred ? 0 : 1
	};
	this.feeds.markStarred(item);
	this.feeds.getStory(this.storyID, this.storyUpdate);
};

FullStoryAssistant.prototype.openURL = function(url) {
	if((url) && (url.length > 0)) {
		this.controller.serviceRequest("palm://com.palm.applicationManager", {
			method: "open",
			parameters: {
				target: url
			}
		});
	}
};

FullStoryAssistant.prototype.sendChoose = function(command) {
	var i = 0;
	var text = "";
	switch(command) {
		case "send-sms":
			text = $L("Check out this story") + ": ";
			for(i = 0; i < this.urls.length; i++) {
				text += (i > 0 ? ", " : "") + this.urls[i].href;
			}
			FeedReader.sendSMS(text);
			break;

		case "send-email":
			text = this.story.summary + "<br><br>";
			for(i = 0; i < this.urls.length; i++) {
				text += (i > 0 ? "<br>" : "") +
				        '<a href="' + this.urls[i].href + '">' +
						this.urls[i].title + '</a>';
			}
			FeedReader.sendEMail($L("Check out this story"), text);
			break;
	}
};

FullStoryAssistant.prototype.handleCommand = function(event) {
	if(event.type === Mojo.Event.command) {
		switch(event.command) {
			case "do-previousStory":
				this.feeds.markStoryRead(this.story);
				this.controller.stageController.swapScene({
					name: "fullStory",
					transition: Mojo.Transition.crossFade
				}, this.feeds, this.feed, this.storyList[this.storyIndex - 1]);
				break;

			case "do-nextStory":
				this.feeds.markStoryRead(this.story);
				this.controller.stageController.swapScene({
					name: "fullStory",
					transition: Mojo.Transition.crossFade
				}, this.feeds, this.feed, this.storyList[this.storyIndex + 1]);
				break;

			case "do-deleteStory":
				this.feeds.deleteStory(this.story);
				this.controller.stageController.popScene();
				break;

			case "do-togglePlay":
				this.togglePlay();
				break;

			case "do-stop":
				this.stopMedia();
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

FullStoryAssistant.prototype.considerForNotification = function(params){
	if(params) {
		switch(params.type) {
			case "app-activate":
				Mojo.Log.info("FULLSTORY> App re-activated; updating display");
				this.activate();
				break;

			case "feed-update":
				this.feeds.getFeed(this.feed.id, this.feedDataHandler);
				break;
		}
	}

	return params;
};

FullStoryAssistant.prototype.handleClick = function(href) {
	if((!href) || this.scrolling) {
		return;
	}

	Mojo.Log.info("FULLSTORY> opening embedded link", href);
	this.openURL(href);
};

FullStoryAssistant.prototype.handleMouseDown = function(event) {
	this.mouseDown = true;
	this.scrolling = false;
	return true;
};

FullStoryAssistant.prototype.handleMouseUp = function(event) {
	this.mouseDown = false;
	if(this.scrolling) {
		event.preventDefault();
		event.stopPropagation();
	}
	return true;
};

FullStoryAssistant.prototype.handleMouseMove = function(event) {
	this.scrolling = true;
	return true;
};
