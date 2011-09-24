/*
 *		source/controls/enhancedaudio.js - Enyo Audio Control
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

var mediaStates = {
	buffering:	-2,
	error:		-1,
	stopped:	0,
	ended:		1,
	aborted:	2,
	paused:		3,
	playing:	4
};

enyo.kind({
	name:		"EnhancedAudio",
	kind:		"Control",

	nodeTag:	"audio",

	_connected:				false,
	_mediaState:			mediaStates.stopped,
	_seeking:				false,
	_domEventDispatcher: 	null,

	events:	{
		onCanPlay:			"",
		onCanPlayThrough:	"",
		onProgress:			"",
		onStalled:			"",
		onSeeking:			"",
		onSeeked:			"",
		onEnded:			"",
		onAborted:			"",
		onError:			"",
		onStateChanged:		""
	},

	published: {
		src:		"",
		audioClass:	"media",
		preload:	true
	},

	//
	// Property handling
	//

	srcChanged: function() {
		this._seeking = false;
		this._mediaState = mediaStates.buffering;
		this.doStateChanged();
		this.setAttribute("src", this.src);
		if(this.hasNode()) {
			this.node.load();
		}
	},

	preloadChanged: function() {
		this.setAttribute("autobuffer", this.preload ? "autobuffer" : null);
		this.setAttribute("preload", this.preload ? "preload" : null);
	},

	audioClassChanged: function() {
		if(this.audioClass) {
			this.setAttribute("x-palm-media-audio-class", this.audioClass);
		} else {
			this.removeAttribute("x-palm-media-audio-class");
		}
	},

	//
	// Media control
	//

	play: function() {
		if(this.hasNode()) {
			this.node.play();
			this._mediaState = mediaStates.playing;
			this.doStateChanged();
		}
	},

	pause: function() {
		if(this.hasNode()) {
			this.node.pause();
			this._mediaState = mediaStates.paused;
			this.doStateChanged();
		}
	},

	stop: function(noEvent) {
		if(this.hasNode()) {
			if(this.getPlaying()) {
				this.node.pause();
			}
			this.node.currentTime = 0;
			this._mediaState = mediaStates.stopped;
			if(!noEvent) {
				this.doStateChanged();
			}
		}
	},

	seek: function(timeIndex) {
		if(this.hasNode()) {
			this.node.currentTime = timeIndex;
		}
	},

	getCurrentTime: function() {
		if(this.hasNode()) {
			return this.node.currentTime;
		} else {
			return 0;
		}
	},

	getDuration: function() {
		if(this.hasNode()) {
			return this.node.duration;
		} else {
			return 9999;
		}
	},

	getPlaying: function() {
		return (this._mediaState >= mediaStates.playing);
	},

	getBuffered: function() {
		if(this.hasNode()) {
			return this.node.buffered;
		} else {
			return null;
		}
	},

	//
	// Helper functions
	//

	getReadableState: function() {
		switch(this._mediaState) {
			case mediaStates.buffering:
				return $L("Buffering");
			case mediaStates.error:
				return $L("Media error");
			case mediaStates.stopped:
				return $L("Stopped");
			case mediaStates.ended:
				return $L("Ended");
			case mediaStates.aborted:
				return $L("Stopped");
			default:
				if(this._seeking) {
					return $L("Seeking")
				} else {
					if(this._mediaState == mediaStates.playing) {
						return $L("Playing");
					} else {
						return $L("Paused");
					}
				}
		}
	},

	//
	// DOM event handlers
	//

	canplayHandler: function(sender) {
		if(this._mediaState == mediaStates.buffering) {
			this._mediaState = mediaStates.stopped;
		}
		this.doCanPlay();
		this.doStateChanged();
		return true;
	},

	canplaythroughHandler: function(sender) {
		this.doCanPlayThrough();
		this.doStateChanged();
		return true;
	},

	progressHandler: function(sender) {
		if(this.hasNode()) {
			this.doProgress(this.node.currentTime);
			this.doStateChanged();
		}
		return true;
	},

	stalledHandler: function(sender) {
		this.doStalled();
		return true;
	},

	seekingHandler: function(sender) {
		this._seeking = true;
		this.doSeeking();
		this.doStateChanged();
		return true;
	},

	seekedHandler: function(sender) {
		this._seeking = false;
		this.doSeeked();
		this.doStateChanged();
		return true;
	},

	abortHandler: function(sender) {
		this._mediaState = mediaStates.aborted;
		this.doAborted();
		this.doStateChanged();
		return true;
	},

	endedHandler: function(sender) {
		this._mediaState = mediaStates.ended;
		this.doEnded();
		this.doStateChanged();
		return true;
	},

	errorHandler: function(sender) {
		this._mediaState = mediaStates.error;
		this.doError();
		this.doStateChanged();
		return true;
	},

	//
	// Initialization
	//

	create: function() {
		this.inherited(arguments);
		this.srcChanged();
		this.preloadChanged();

		this._domEventDispatcher = enyo.bind(this, this.dispatchDomEvent);
	},

	rendered: function() {
		this.inherited(arguments);
		if(this.hasNode()) {
			if(!this._connected) {
				this._connected = true;
				this.node.addEventListener('canplay', this._domEventDispatcher);
				this.node.addEventListener('progress', this._domEventDispatcher);
				this.node.addEventListener('canplaythough', this._domEventDispatcher);
				this.node.addEventListener('seeking', this._domEventDispatcher);
				this.node.addEventListener('seeked', this._domEventDispatcher);
				this.node.addEventListener('abort', this._domEventDispatcher);
				this.node.addEventListener('ended', this._domEventDispatcher);
				this.node.addEventListener('error', this._domEventDispatcher);
				this.node.addEventListener('stalled', this._domEventDispatcher);
			}
		}
	}
});
