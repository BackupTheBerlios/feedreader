/*
 *		app/assistants/fullStory-assistant.js
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

function FullStoryAssistant(feeds, feedIndex, storyList, storyIndex) {
	this.feeds = feeds;
	this.storyList = storyList;
	this.storyIndex = storyIndex;
	this.feedIndex = feedIndex;
	
	this.origin = this.storyList[storyIndex];
	this.feed = this.feeds.list[this.origin.feedIndex];
	this.story = this.feed.stories[this.origin.storyIndex];

	this.doShowMedia = this.feeds.list[this.origin.feedIndex].showMedia &&
					   ((this.story.audio.length > 0) ||
					    (this.story.video.length > 0));
	this.doShowPicture = this.feeds.list[this.origin.feedIndex].showPicture;
	
	if(this.story.video.length > 0) {
		this.mediaURL = this.story.video;
		this.mediaMode = 2;
	} else if(this.story.audio.length > 0) {
		this.mediaURL = this.story.audio;
		this.mediaMode = 1;
	} else {
		this.mediaURL = "";
		this.mediaMode = 0;
	}
	
	this.commandModel = {};
	this.setupComplete = false;
	
	this.pictureSpinnerModel = {
		spinning: false
	};
	
	this.media = undefined;
	this.mediaReady = false;
	this.playState = 0;
	this.seeking = false;

	/* pre bind handlers */	
	if(this.doShowMedia) {
		this.mediaCanPlayHandler = this.mediaCanPlay.bindAsEventListener(this);
		this.mediaPlayingHandler = this.mediaPlaying.bindAsEventListener(this);
		this.mediaSeekingHandler = this.mediaSeeking.bindAsEventListener(this);
		this.mediaSeekedHandler = this.mediaSeeked.bindAsEventListener(this);
		this.mediaStoppedHandler = this.mediaStopped.bindAsEventListener(this);
		this.mediaErrorHandler = this.mediaError.bindAsEventListener(this);
		this.mediaProgressHandler = this.mediaProgress.bind(this);
	}
	this.startSeekingHandler = this.startSeeking.bindAsEventListener(this);
	this.doSeekHandler = this.doSeek.bindAsEventListener(this);
	this.stopSeekingHandler = this.stopSeeking.bindAsEventListener(this);
	this.sendChooseHandler = this.sendChoose.bind(this);
	
	this.storyTapHandler = this.storyTap.bindAsEventListener(this);
	this.pictureLoadedHandler = this.pictureLoaded.bind(this);
}

FullStoryAssistant.prototype.setup = function() {
	FeedReader.beginSceneSetup(this, true);

	this.controller.setDefaultTransition(Mojo.Transition.defaultTransition);

	this.controller.get("appIcon").className += " " + this.feeds.getFeedHeaderIcon(this.feeds.list[this.feedIndex]);
	this.controller.get("feed-title").update(this.feeds.getFeedTitle(this.feeds.list[this.origin.feedIndex]));
	this.controller.get("story-date").update(this.feeds.dateConverter.dateToLocalTime(this.story.intDate));

	if(this.feeds.showCaption(this.feeds.list[this.origin.feedIndex], true)) {
		this.controller.get("story-title").update(this.story.title);
	}
	
	if(this.feeds.showSummary(this.feeds.list[this.origin.feedIndex], true)) {
		this.controller.get("story-content").update(this.story.summary);
	}
	
	// Setup the story's picture.
	this.controller.setupWidget("picture-spinner", { spinnerSize: "small" },
								this.pictureSpinnerModel);
	if(this.doShowPicture && (this.story.picture.length > 0)) {
		this.controller.get("story-picture").src = this.story.picture;
		this.pictureSpinnerModel.spinning = true;
		this.controller.get("story-picture").onload = this.pictureLoadedHandler;
	} else {
		this.controller.get("img-container").className = "hidden";		
	}
	
	// Setup player controls.
	if(this.mediaMode == 2) {
		// Re-order the DOM nodes.
		var wrapper = this.controller.get("media-controls-wrapper");
		var content = this.controller.get("fullStoryScene");
		var video = this.controller.get("media-video");
		content.appendChild(video);
		content.appendChild(wrapper);
		wrapper.className = "video";
		
		// Delete the list fades.
		var node = this.controller.get("fade-top");
		node.parentNode.removeChild(node);
		node = this.controller.get("fade-bottom");
		node.parentNode.removeChild(node);
	}
	
	// The controls should be intialized even if no audio is to be played.
	this.controller.setupWidget("media-progress", this.mediaProgressAttribs = {
		sliderProperty: "value",
		round: true,
		updateInterval: 0.2
	}, this.mediaProgressModel = {
		progressStart: 0,
		progressEnd: 0,
		value: 0,
		minValue: 0,
		maxValue: 1000,
		disabled: true
	});
	this.controller.listen("media-progress", Mojo.Event.propertyChange, this.doSeekHandler);
	this.controller.listen("media-progress", Mojo.Event.sliderDragStart, this.startSeekingHandler);
	this.controller.listen("media-progress", Mojo.Event.sliderDragEnd, this.stopSeekingHandler);

	// Setup command menu.
	this.initCommandModel();
    this.controller.setupWidget(Mojo.Menu.commandMenu, undefined, this.commandModel);

	if(!this.doShowMedia) {
		// Hide the player.
		this.controller.get("media-controls-wrapper").className = "hidden";
	} else {	
		// Setup media player.
		switch(this.mediaMode) {
			case 1:
				this.media = new Audio();
				// Remove the video element.
				var video = this.controller.get("media-video");
				video.parentNode.removeChild(video);
				break;
			
			case 2:			
				this.media = this.controller.get("media-video");
			    this.controller.listen("media-video", Mojo.Event.tap, this.storyTapHandler);
				break;
		}
		this.media.autoPlay = false;
		this.media.addEventListener("canplay", this.mediaCanPlayHandler, false);
		this.media.addEventListener("play", this.mediaPlayingHandler, false);
		this.media.addEventListener("seeking", this.mediaSeekingHandler, false);
		this.media.addEventListener("seeked", this.mediaSeekedHandler, false);
		this.media.addEventListener("abort", this.mediaStoppedHandler, false);
		this.media.addEventListener("ended", this.mediaStoppedHandler, false);
		this.media.addEventListener("error", this.mediaErrorHandler, false);
		this.controller.get("media-playState").update($L("Waiting for data"));		
		this.media.src = this.mediaURL;
		this.media.load();
	}

	// Setup story view.
	this.controller.get("story-title").className += " " + FeedReader.prefs.titleColor + (FeedReader.prefs.largeFont ? " large" : "");
	this.controller.get("story-content").className += (FeedReader.prefs.largeFont ? " large" : "");
		
	// Handle a story click.
    this.controller.listen("story-content", Mojo.Event.tap, this.storyTapHandler);
	this.controller.listen("story-title", Mojo.Event.tap, this.storyTapHandler);

	FeedReader.endSceneSetup(this, this.mediaMode != 2);
};

FullStoryAssistant.prototype.activate = function(event) {
	if(this.setupComplete) {
		this.initCommandModel();
		this.controller.modelChanged(this.commandModel);
		this.controller.modelChanged(this.pictureSpinnerModel);
	}
};

FullStoryAssistant.prototype.deactivate = function(event) {
};

FullStoryAssistant.prototype.cleanup = function(event) {
	if(this.media) {
		this.media.removeEventListener("canplay", this.mediaCanPlayHandler);
		this.media.removeEventListener("play", this.mediaPlayingHandler);
		this.media.removeEventListener("seeking", this.mediaSeekingHandler);
		this.media.removeEventListener("seeked", this.mediaSeekedHandler);
		this.media.removeEventListener("abort", this.mediaStoppedHandler);
		this.media.removeEventListener("ended", this.mediaStoppedHandler);
		this.media.removeEventListener("error", this.mediaErrorHandler);
		try {
			this.setMediaTimer(false);
			this.media.src = "";
			this.media.load();
		} catch(e) {
		}
		delete this.media;
	}
	if(!this.story.isRead) {
		this.feeds.markStoryRead(this.origin.feedIndex, this.origin.storyIndex);
	}
};

FullStoryAssistant.prototype.initCommandModel = function() {
	this.commandModel.label = "";
    this.commandModel.items = [{
		items: [{
			icon: "back",
			disabled: this.storyIndex === 0,
			command: "do-previousStory"
		}, {
			icon: "forward",
			disabled: this.storyIndex === (this.storyList.length - 1),
			command: "do-nextStory"
		}]
	}];
	
	if(this.doShowMedia) {
		this.commandModel.items.push({
			items :[{
				icon: "send",
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
			icon: "send",
			command: "do-send"
		});
	}
	
	if(!FeedReader.prefs.leftHanded) {
		this.commandModel.items.reverse();
	}
};

FullStoryAssistant.prototype.pictureLoaded = function() {
	this.pictureSpinnerModel.spinning = false;
	this.controller.modelChanged(this.pictureSpinnerModel);	
};

FullStoryAssistant.prototype.mediaCanPlay = function(event) {
	Mojo.Log.info("MEDIA> media can play");
	this.mediaReady = true;
	this.updateMediaUI();
}

FullStoryAssistant.prototype.mediaPlaying = function(event) {
	Mojo.Log.info("MEDIA> media playing");
	this.mediaReady = true;
	this.playState = 1;
	this.updateMediaUI();
};

FullStoryAssistant.prototype.mediaSeeking = function(event) {
	Mojo.Log.info("MEDIA> media seeking");
	this.controller.get("media-playState").update($L("Seeking"));
};


FullStoryAssistant.prototype.mediaSeeked = function(event) {
	Mojo.Log.info("MEDIA> media seeked");
	this.updateMediaUI();
};

FullStoryAssistant.prototype.mediaStopped = function(event) {
	Mojo.Log.info("MEDIA> media stopped");
	this.playState = 0;
	this.currentTime = 0;
	this.updateMediaUI();
};

FullStoryAssistant.prototype.mediaError = function(event) {
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
			this.timer = this.controller.window.setInterval(this.mediaProgressHandler, 200);
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

FullStoryAssistant.prototype.sendChoose = function(command) {
	switch(command) {
		case "send-sms":
			FeedReader.sendSMS($L("Check out this story") + ": " + this.story.url);
			break;
		
		case "send-email":
			FeedReader.sendEMail($L("Check out this story"), this.story.summary +
								 '<br><br><a href="' + this.story.url + '">' + this.story.url + '</a>');
			break;
	}
};

FullStoryAssistant.prototype.handleCommand = function(event) {
	if(event.type === Mojo.Event.command) {
		switch(event.command) {
			case "do-previousStory":
				this.feeds.markStoryRead(this.origin.feedIndex, this.origin.storyIndex);
				this.controller.stageController.swapScene({
					name: "fullStory",
					transition: Mojo.Transition.crossFade
				}, this.feeds, this.feedIndex, this.storyList, this.storyIndex - 1);
				break;
				
			case "do-nextStory":
				this.feeds.markStoryRead(this.origin.feedIndex, this.origin.storyIndex);
				this.controller.stageController.swapScene({
					name: "fullStory",
					transition: Mojo.Transition.crossFade
				}, this.feeds, this.feedIndex, this.storyList, this.storyIndex + 1);
				break;
			
			case "do-togglePlay":
				this.togglePlay();
				break;
			
			case "do-stop":
				this.stopMedia();
				break;
			
			case "do-send":
				this.controller.popupSubmenu({
					onChoose:  this.sendChooseHandler,
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