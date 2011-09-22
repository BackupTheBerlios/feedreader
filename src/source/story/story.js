/*
 *		source/story/story.js
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

enyo.kind({
	name:	"HeaderInfoLabel",
	kind:	"HFlexBox",

	align:	"center",
	pack:	"center",

	published:	{
		caption:	"",
		label:		""
	},

	components:	[{
		name:			"caption",
		className:		"enyo-label story-header-label"
	}, {
		name:			"label",
		flex:			1
	}],

	captionChanged: function() {
		this.$.caption.setContent(this.caption);
	},

	labelChanged: function() {
		this.$.label.setContent(this.label);
	},

	create: function() {
		this.inherited(arguments);
		this.captionChanged();
		this.labelChanged();
	}
});

enyo.kind({
	name:		"StoryView",
	kind:		"VFlexBox",
	className:	"story-body",

	published:	{
		feed:		null,
		story:		null,
		isRefresh:	false
	},

	urls:			[],
	originFeed:		null,

	components:	[{
		name:			"header",
		kind:			"Toolbar",
		className:		"enyo-toolbar-light",
		components:		[{
			name:		"backButton",
			icon:		"../../images/header/icon-back.png",
			enabled:	false,
			showing:	false,
			onclick:	"backClicked"
		}, {
			name:		"forwardButton",
			icon:		"../../images/header/icon-forward.png",
			enabled:	false,
			showing:	false,
			onclick:	"forwardClicked"
		}, {
			name:		"loadSpinner",
			kind:		"Spinner"
		}, {
			kind:		"Spacer"
		}, {
			name:		"starButton",
			kind:		"StarButton",
			disabled:	true,
			onChange:	"storyStarred"
		}]
	}, {
		name:			"storyContainer",
		kind:			"VFlexBox",
		flex:			1,
		showing:		false,
		defaultKind:	"Control",
		components:		[{
			className:	"story-body-header",
			components:	[{
				name:		"date",
				kind:		"HeaderInfoLabel",
				caption:	$L("Date")
			}, {
				kind:		"DottedSeparator"
			}, {
				name:		"caption",
				kind:		"HeaderInfoLabel",
				caption:	$L("Caption")
			}]
		}, {
			className:	"header-shadow"
		}, {
			kind:			"Scroller",
			style:			"margin: 10px",
			flex:			1,
			components:		[{
				name:		"pictureBox",
				nodeTag:	"div",
				style:		"text-align: center;",
				components:	[{
					name:			"picture",
					kind:			"Image",
					style:			"max-width: 98%",
					onload:			"pictureLoaded"
				}]
			}, {
				name:			"content",
				kind:			"HtmlContent",
				onLinkClick:	"innerLinkClicked"
			}, {
				kind:				"SilverSeparator"
			}, {
				name:				"linkButton",
				kind:				"IconButton",
				icon:				"weblink-image",
				iconIsClassName:	true,
				className:			"weblink-button",
				caption:			$L("Open Weblink"),
				onclick:			"linkClicked"
			}]
		}]
	}, {
		name:				"webView",
		kind:				"WebView",
		flex:				1,
		showing:			false,
		ignoreMetaTags:		true,
		blockPopups:		true,
		enableJavascript: 	true,
		onLoadStarted:		"loadStarted",
		onLoadStopped:		"loadFinished",
		onLoadComplete:		"loadFinished",
		onPageTitleChanged: "pageTitleChanged"
	}, {
		name:		"mediaControls",
		showing:	false
	}, {
		name:		"bgContainer",
		kind:		"HFlexBox",
		className:	"basic-back",
		align:		"center",
		pack:		"center",
		flex:		1,
		components:	[{
			name:	"bgImage",
			kind:	"Image",
			src:	"../../images/nodata-background.png"
		}]
	}, {
		kind:			"Toolbar",
		components:		[{
			kind:		"GrabButton"
		}, {
			kind:		"Spacer"
		}, {
			name:		"shareButton",
			kind:		"ToolButton",
			icon:		"../../images/toolbars/icon-share.png",
			onclick:	"shareClicked"
		}]
	}, {
		name:			"linkMenu",
		kind:			"Menu"
	}, {
		name:			"shareMenu",
		kind:			"Menu",
		components:		[{
			caption:	$L("Send via E-Mail"),
			onclick:	"shareViaEmail"
		}, {
			caption:	$L("Send via SMS/IM"),
			onclick:	"shareViaIM"
		}]
	}],

	//
	// Property handling
	//

	storyChanged: function() {
		if(!this.isRefresh) {
			this.$.loadSpinner.hide();
			this.$.backButton.setDisabled(true);
			this.$.forwardButton.setDisabled(true);
		}
		if(!this.story) {
			this.$.starButton.setChecked(false);
			this.$.starButton.setDisabled(true);
			this.$.shareButton.setDisabled(true);
			this.$.bgContainer.show();
			this.$.storyContainer.hide();
			this.$.webView.hide();

			this.isRefresh = false;
			this.originFeed = null;
			this.urls = [];
		} else {
			enyo.application.feeds.getStory(this.story.id, this.gotStory);
		}
	},

	//
	// Story handling
	//

	gotStory: function(feed, story, urls) {
		this.originFeed = feed;
		this.story = story;
		this.urls = urls;

		// Handle the largeFont setting.
		this.$.date.applyStyle("font-size", enyo.application.prefs.largeFont ? "120%" : "100%");
		this.$.caption.applyStyle("font-size", enyo.application.prefs.largeFont ? "120%" : "100%");
		this.$.content.applyStyle("font-size", enyo.application.prefs.largeFont ? "120%" : "100%");

		this.$.date.setLabel(enyo.application.feeds.getDateFormatter().formatDateTime(this.story.pubdate));
		this.$.caption.setLabel(this.story.title);
		this.$.starButton.setChecked(this.story.isStarred);
		this.$.starButton.setDisabled(false);
		this.$.shareButton.setDisabled(false);

		if(this.originFeed.fullStory) {
			this.$.content.setContent(this.story.summary);
			if(!this.story.picture || (this.story.picture.length <= 0)) {
				this.$.picture.hide();
				this.$.loadSpinner.hide();
			} else {
				this.log("STORY> retrieving picture from", this.story.picture);
				this.$.picture.setSrc("");
				this.$.picture.show();
				if(!this.isRefresh) {
					this.$.loadSpinner.show();
				}
				this.$.picture.setSrc(this.story.picture);
				enyo.application.connChecker.checkConnection(enyo.application.nop, this.noConnection);
			}
			this.$.backButton.hide();
			this.$.forwardButton.hide();
			this.$.loadSpinner.hide();
		} else {
			if(this.urls.length > 0) {
				if(!this.isRefresh) {
					this.$.webView.clearHistory();
					this.$.webView.setUrl(this.urls[0].href);
					this.$.loadSpinner.show();
				}
				this.$.backButton.show();
				this.$.forwardButton.show();
			}
		}

		// Mark the story as being read.
		if(!this.isRefresh && !this.story.isRead) {
			enyo.application.feeds.markStoryRead(this.story);
		}

		// Setup the visible elements.
		this.$.bgContainer.hide();
		if(this.originFeed.fullStory) {
			this.$.webView.hide();
			this.$.storyContainer.show();
			this.$.linkButton.setDisabled(this.urls.length <= 0);
			if(this.story.audio || this.story.video) {
				this.$.mediaControls.show();
			} else {
				this.$.mediaControls.hide();
			}
		} else {
			this.$.mediaControls.hide();
			this.$.storyContainer.hide();
			this.$.webView.show();
		}
		this.isRefresh = false;
	},

	noConnection: function() {
		this.$.picture.hide();
		this.$.loadSpinner.hide();
	},

	pictureLoaded: function() {
		this.log("STORY> picture loaded");
		this.$.loadSpinner.hide();
	},

	loadStarted: function() {
		this.$.loadSpinner.show();
	},

	loadFinished: function() {
		this.$.loadSpinner.hide();
	},

	pageTitleChanged: function(sender, title, url, canGoBack, canGoForward) {
		if(this.$.loadSpinner.getShowing()) {
			this.$.backButton.setDisabled(!canGoBack);
			this.$.forwardButton.setDisabled(!canGoForward);
		}
	},

	backClicked: function(sender, event) {
		this.$.webView.goBack();
	},

	forwardClicked: function(sender, event) {
		this.$.webView.goForward();
	},

	innerLinkClicked: function(sender, url) {
		enyo.application.openLink(url);
	},

	linkClicked: function(sender, event) {
		if(this.urls.length == 1) {
			enyo.application.openLink(this.urls[0].href);
		} else if(this.urls.length > 1) {
			// show a menu
		}
	},

	//
	// Toolbar handling
	//

	storyStarred: function() {
		this.story.isStarred = this.$.starButton.getChecked();
		enyo.application.feeds.markStarred(this.story);
	},

	shareClicked: function(sender, event) {
		this.$.shareMenu.openAtEvent(event);
	},

	//
	// Sharing
	//

	shareViaEmail: function(sender, event) {
		text = this.story.summary + "<br><br>";
		for(i = 0; i < this.urls.length; i++) {
			text += (i > 0 ? "<br>" : "") +
					'<a href="' + this.urls[i].href + '">' +
					this.urls[i].title + '</a>';
		}
		enyo.application.openEMail($L("Check out this story"), text);
	},

	shareViaIM: function(sender, email) {
		text = $L("Check out this story") + ": ";
		for(i = 0; i < this.urls.length; i++) {
			text += (i > 0 ? ", " : "") + this.urls[i].href;
		}
		enyo.application.openMessaging(text);
	},

	//
	// Public functions
	//

	refresh: function() {
		this.isRefresh = true;
		this.storyChanged();
	},

	//
	// Initialization
	//

	create: function() {
		this.inherited(arguments);

		this.gotStory = enyo.bind(this, this.gotStory);
		this.noConnection = enyo.bind(this, this.noConnection);

		this.storyChanged();
	}
});
