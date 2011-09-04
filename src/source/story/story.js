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

	isRefresh:	false,

	published:	{
		feed:	null,
		story:	null
	},

	components:	[{
		name:			"header",
		kind:			"Toolbar",
		className:		"enyo-toolbar-light",
		components:		[{
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
			}, {
				className:	"header-shadow"
			}]
		}, {
			kind:			"Scroller",
			style:			"margin: 10px",
			flex:			1,
			components:		[{
				name:		"pictureBox",
				nodeTag:	"div",
				style:		"text-align: center;",
				components:	[{
					name:			"pictureSpinner",
					kind:			"Spinner"
				}, {
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
				kind:				"IconButton",
				icon:				"weblink-image",
				iconIsClassName:	true,
				className:			"weblink-button",
				caption:			$L("Open Weblink"),
				onclick:			"linkClicked"
			}]
		}]
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
		}]
	}, {
		name:			"linkMenu",
		kind:			"Menu"
	}],

	storyChanged: function() {
		if(!this.story) {
			this.$.starButton.setChecked(false);
			this.$.starButton.setDisabled(true);
			this.$.bgContainer.show();
			this.$.storyContainer.hide();
		} else {
			this.$.date.setLabel(enyo.application.feeds.getDateFormatter().formatDateTime(this.story.pubdate));
			this.$.caption.setLabel(this.story.title);
			this.$.content.setContent(this.story.summary);
			this.$.starButton.setChecked(this.story.isStarred);
			this.$.starButton.setDisabled(false);

			if(!this.story.picture || (this.story.picture.length <= 0)) {
				this.$.picture.hide();
				this.$.pictureSpinner.hide();
			} else {
				this.log("STORY> retrieving picture from", this.story.picture);
				this.$.picture.setSrc("");
				this.$.picture.show();
				if(!this.isRefresh) {
					this.$.pictureSpinner.show();
				}
				this.$.picture.setSrc(this.story.picture);
			}

			// Mark the story as being read.
			enyo.application.feeds.markStoryRead(this.story);

			// Show the story container.
			this.$.bgContainer.hide();
			this.$.storyContainer.show();
		}

		this.isRefresh = false;
	},

	pictureLoaded: function() {
		this.log("STORY> picture loaded");
		this.$.pictureSpinner.hide();
	},

	storyStarred: function() {
		this.story.isStarred = this.$.starButton.getChecked();
		this.log("STORY>", this.story.isStarred);
		enyo.application.feeds.markStarred(this.story);
	},

	innerLinkClicked: function(sender, url) {
		enyo.application.openLink(url);
	},

	linkClicked: function(sender, event) {
		enyo.application.feeds.getStory(this.story.id, this.gotStory);
	},

	gotStory: function(feed, story, urls) {
		this.feed = feed;
		this.story = story;

		if(urls.length == 1) {
			enyo.application.openLink(urls[0].href);
		} else if(urls.length > 1) {
			// show a menu
		}

		this.isRefresh = true;
		this.storyChanged();
	},

	create: function() {
		this.inherited(arguments);
		this.gotStory = enyo.bind(this, this.gotStory);
	}
});
