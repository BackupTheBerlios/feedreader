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
	this.audio = undefined;
	this.timer = undefined;
	this.audioReady = false;
	this.playState = 0;
	this.ignoreStop = false;
	
	this.audioConnectedHandler = this.audioConnected.bindAsEventListener(this);
	this.audioDisConnectedHandler = this.audioDisConnected.bindAsEventListener(this);
	this.audioCanPlayHandler = this.audioCanPlay.bindAsEventListener(this);
	this.audioPlayingHandler = this.audioPlaying.bindAsEventListener(this);
	this.audioPausedHandler = this.audioPaused.bindAsEventListener(this);
	this.audioStoppedHandler = this.audioStopped.bindAsEventListener(this);
	
	this.togglePlaystateHandler = this.togglePlaystate.bindAsEventListener(this);
	this.stopAudioHandler = this.stopAudio.bindAsEventListener(this);
	this.updateProgressHandler = this.updateProgress.bind(this);
	
	this.storyTapHandler = this.storyTap.bindAsEventListener(this);
}

FullStoryAssistant.prototype.setup = function() {
	// Setup application menu.
	this.controller.setupWidget(Mojo.Menu.appMenu, FeedReader.menuAttr, FeedReader.menuModel);

	this.controller.setDefaultTransition(Mojo.Transition.defaultTransition);

	this.controller.get("appIcon").className += " " + this.feeds.getFeedHeaderIcon(this.feed);
	this.controller.get("feed-title").update(this.feeds.getFeedTitle(this.feeds.list[this.originFeed]));
	this.controller.get("story-date").update(this.feeds.dateConverter.dateToLocalTime(this.story.intDate));
	this.controller.get("story-title").update(this.story.title);
	this.controller.get("story-content").update(this.story.summary);
	
	// Setup the story's picture.
	if(this.story.picture.length > 0) {
		this.controller.get("story-picture").src = this.story.picture;
	} else {
		this.controller.get("img-container").className = "hidden";		
	}
	
	// Setup audio.
	this.audio = AudioTag.extendElement(this.controller.get("audio-container"), this.controller);
	this.audio.addEventListener(Media.Event.X_PALM_CONNECT, this.audioConnectedHandler, false);
	this.audio.addEventListener(Media.Event.X_PALM_DISCONNECT, this.audioDisConnectedHandler, false);
	this.audio.addEventListener(Media.Event.CANPLAY, this.audioCanPlayHandler, false);
	this.audio.addEventListener(Media.Event.PLAY, this.audioPlayingHandler, false);
	this.audio.addEventListener(Media.Event.PAUSE, this.audioPausedHandler, false);
	this.audio.addEventListener(Media.Event.ABORT, this.audioStoppedHandler, false);
	this.audio.addEventListener(Media.Event.ENDED, this.audioStoppedHandler, false);
	this.audio.addEventListener(Media.Event.ERROR, this.audioStoppedHandler, false);
	
	this.audio.palm.audioClass = Media.AudioClass.MEDIA;

	// Setup audio player controls.
	this.controller.setupWidget("audio-player", this.audioAttribs = {
		modelProperty: 'progress',
		round: true,
		image: "images/player/icon-stop.png"
	}, this.audioModel = {
		progress: 0,
		icon: "action-icon play"
	});
	this.controller.listen("audio-player", Mojo.Event.progressIconTap, this.togglePlaystateHandler);
	this.controller.listen("audio-controls", Mojo.Event.tap, this.stopAudioHandler);
	
	if(this.story.audio.length <= 0) {
		this.controller.get("audio-container").className = "hidden";
		this.controller.get("audio-controls").className = "hidden";
	}

	this.controller.get("story-title").className += " " + FeedReader.prefs.titleColor + (FeedReader.prefs.largeFont ? " large" : "");
	this.controller.get("story-content").className += (FeedReader.prefs.largeFont ? " large" : "");
	
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

    this.controller.listen("story-content", Mojo.Event.tap, this.storyTapHandler);
};

FullStoryAssistant.prototype.activate = function(event) {
};

FullStoryAssistant.prototype.deactivate = function(event) {
};

FullStoryAssistant.prototype.cleanup = function(event) {
};

FullStoryAssistant.prototype.audioConnected = function(event) {
	Mojo.Log.info("Audio connected");
	event.target.palm.audioClass = "media";
 
	this.audioReady = true;
};

FullStoryAssistant.prototype.audioDisConnected = function(event) {
	Mojo.Log.info("Audio disconnected");
	this.audioReady = false;
};

FullStoryAssistant.prototype.audioCanPlay = function(event) {
	Mojo.Log.info("Audio now ready for playing");
};

FullStoryAssistant.prototype.togglePlaystate = function(event) {
	this.ignoreStop = true;
	
	if(!this.audioReady) {
		return;
	}
	
	switch(this.playState) {
		case 0:		// stopped
			Mojo.Log.info("Setting audio src", this.story.audio);
			this.audio.src = this.story.audio;
			break;
		
		case 1:		// playing
			this.audio.pause();
			break;
		
		case 2:		// paused
			this.audio.play();
			break;
	}	
};

FullStoryAssistant.prototype.stopAudio = function(event) {
	if(this.ignoreStop) {
		this.ignoreStop = false;
		return;
	}
	
	if(this.playState != 0) {
		this.audio.src = "";
		this.audio.load();
	}
};

FullStoryAssistant.prototype.audioPlaying = function(event) {
	this.playState = 1;
	this.audioModel.icon = "action-icon pause";
	this.controller.modelChanged(this.audioModel);
	this.timer = this.controller.window.setInterval(this.updateProgressHandler, 500);
};

FullStoryAssistant.prototype.audioPaused = function(event) {
	this.playState = 2;
	this.audioModel.icon = "action-icon play";
	this.controller.modelChanged(this.audioModel);
	if(this.timer) {
		this.controller.window.clearInterval(this.timer);
		this.timer = undefined;
	}
};

FullStoryAssistant.prototype.audioStopped = function(event) {
	this.playState = 0;
	this.audioModel.icon = "action-icon play";
	this.audioModel.progress = 0;
	this.controller.modelChanged(this.audioModel);
	if(this.timer) {
		this.controller.window.clearInterval(this.timer);
		this.timer = undefined;
	}
};

FullStoryAssistant.prototype.updateProgress = function() {
	if(this.audio.duration > 0) {
		this.audioModel.progress = this.audio.currentTime / this.audio.duration;
		this.controller.modelChanged(this.audioModel);		
	}
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