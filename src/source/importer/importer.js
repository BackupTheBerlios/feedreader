/*
 *		source/importer/importer.js
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
	name:			"FeedImporter",
	kind:			"VFlexBox",

	events:			{
		onBackClick:	""
	},

	items:			[],
	url:			"",
	initialized:	false,
	inHeader:		false,
	parserHandler:	null,
	index:			0,

	components:	[{
		kind:		"Toolbar",
		content:	$L("Import feeds"),
		className:	"enyo-toolbar-light"
	}, {
		kind:		"VFlexBox",
		flex:		1,
		align:		"center",
		components:	[{
			className:	"additional-scene-width",
			layoutKind:	"VFlexLayout",
			align:		"left",
			flex:		1,
			components:	[{
				kind:		"RowGroup",
				caption:	$L("Origin"),
				components:	[{
					name:			"url",
					kind:			"Input",
					autoCapitalize:	"lowercase",
					inputType:		"url",
					hint:			$L("URL of website...")
				}]
			}, {
				name:		"scanButton",
				kind:		"ActivityButton",
				caption:	$L("Scan for feeds"),
				onclick:	"scanURL"
			}, {
				kind:		"Divider",
				caption:	$L("Feeds")
			}, {
				name:		"noScanLabel",
				style:		"margin: 20px",
				content:	$L("Enter a URL and tap <b>Scan for feeds</b>.")
			}, {
				name:		"noConnLabel",
				style:		"margin: 20px",
				content:	$L("No Internet connection available.")
			}, {
				name:		"noDataLabel",
				style:		"margin: 20px",
				content:	$L("No feeds found. Maybe the URL is wrong.")
			}, {
				name:		"list",
				kind:		"VirtualList",
				flex:		1,
				onSetupRow:	"setupRow",
				components:	[{
					name:		"item",
					kind:		"Item",
					onclick:	"feedClicked",
					components:	[{
						kind:		"HFlexBox",
						components:	[{
							name:		"feedInfoBox",
							nodeTag:	"div",
							className:	"feed-infobox",
							components:	[{
								kind:	"Image",
								name:	"feedIcon",
								src:	"../../images/lists/icon-rss.png",
								style:	"max-width: 40px; max-height: 40px;"
							}]
						}, {
							kind:	"VFlexBox",
							flex:	1,
							components: [{
								name:		"feedTitle",
								className:	"feed-title"
							}, {
								name:		"feedURL",
								className:	"feed-url"
							}]
						}]
					}]
				}]
			}]
		}]
	}, {
		kind:		"Toolbar",
		components:	[{
			kind:		"ToolButton",
			content:	$L("Back"),
			onclick:	"doBackClick"
		}, {
			kind:		"Spacer"
		}]
	}, {
		name:		"webService",
		kind:		"WebService",
		method:		"get",
		handleAs:	"text",
		onSuccess:	"retrievalSuccess",
		onFailure:	"retrievalFailed"
	}, {
		name:	"parser",
		kind:	"SimpleHtmlParser"
	}, {
		name:	"connChecker",
		kind:	"ConnectionChecker"
	}, {
		kind: 					"DialogPrompt",
		name:					"subscribeDialog",
		title: 					$L("Subscribe to feed"),
		acceptButtonCaption: 	$L("Yes"),
		cancelButtonCaption: 	$L("No"),
		onAccept: 				"doSubscribe"
	}],

	resetScanButton: function() {
		this.inHeader = false;
		this.$.scanButton.setActive(false);
		this.$.scanButton.setDisabled(false);
		this.$.scanButton.setCaption($L("Scan for feeds"));
	},

	reInitialize: function() {
		this.url = "";
		this.items = [];
		this.$.list.refresh();
		this.$.url.setValue("");
		this.resetScanButton();

		this.$.list.hide();
		this.$.noDataLabel.hide();
		this.$.noConnLabel.hide();
		this.$.noScanLabel.show();
	},

	scanURL: function(sender, event) {
		this.$.noScanLabel.hide();
		this.$.noConnLabel.hide();
		this.items = [];

		this.url = enyo.string.trim(this.$.url.getValue());
		if(this.url.length <= 0) {
			this.reInitialize();
			return;
		}

		if(/^[a-z]{1,5}:/.test(this.url) === false) {
			this.url = "http://" + this.url.replace(/^\/{1,2}/, "");
			this.$.url.setValue(this.url);
		}

		this.$.scanButton.setCaption($L("Scanning for feeds..."));
		this.$.scanButton.setActive(true);

		this.$.connChecker.checkConnection(this.connectionAvailable, this.connectionNotAvailable);
	},

	setupRow: function(sender, index) {
		if((index < 0) || (index >= this.items.length)) {
			return false;
		}

		var feed = this.items[index];
		this.$.feedIcon.setSrc("../../images/lists/icon-" + feed.type + ".png");
		this.$.feedTitle.setContent(feed.title);
		this.$.feedURL.setContent(feed.url);

		return true;
	},

	feedClicked: function(sender, event) {
		this.index = event.rowIndex;

		var msg = enyo.macroize($L('Do you want to subscribe to "{$feed}"?'), { feed: this.items[this.index].title });
		this.$.subscribeDialog.setMessage(msg)
		this.$.subscribeDialog.open();
	},

	doSubscribe: function(sender, event) {
		var f = new Feed();
		f.title = this.items[this.index].title;
		f.url = this.items[this.index].url;
		enyo.application.feeds.addOrEditFeed(f);

		this.items.splice(this.index, 1);
		this.$.list.refresh();
	},

	connectionAvailable: function() {
		this.$.webService.call({}, { url: this.url });
	},

	connectionNotAvailable: function() {
		this.$.noConnLabel.show();
		this.resetScanButton();
	},

	retrievalSuccess: function(sender, response, request) {
		if(response && response.length > 0) {
			var url = request.xhr.getResponseHeader("Location");
			if(url && (url.length > 0)) {
				this.url = url;
				this.$.url.setValue(this.url);
			}

			this.log("Got response from web!");
			try {
				this.inHeader = true;
				this.$.parser.parse(response, this.parserHandler);
			} catch(e) {
				this.error("PARSE EXCEPTION>", e)
			}
			this.$.list.punt();
		} else {
			this.log("No data retrieved.");
		}

		if(this.items.length > 0) {
			this.$.noDataLabel.hide();
			this.$.list.show();
		} else {
			this.$.list.hide();
			this.$.noDataLabel.show();
		}
		this.resetScanButton();
	},

	retrievalFailed: function(sender, response, request) {
		this.$.list.hide();
		this.$.noDataLabel.show();
		this.resetScanButton();
	},

	parseStartTag: function(tag, attr) {
		if(tag.match(/head/i)) {
			this.inHeader = true;
		} else if(!this.inHeader) {
			return;
		} else if(tag.match(/link/i)) {
			var possibility = 0;
			var type = "";
			var href = "";
			var title = "RSS Feed";

			for(var i = 0; i < attr.length; i++) {
				if(attr[i] && attr[i].name && attr[i].value) {
					//this.log(attr[i].name, attr[i].value);
					if(attr[i].name.match(/rel/i) &&
					   attr[i].value.match(/alternate/i)) {
						possibility++;
					} else if(attr[i].name.match(/type/i) &&
							  attr[i].value &&
							  attr[i].value.match(/application\/atom\+xml/i)) {
						type = "atom";
						possibility++;
					} else if(attr[i].name.match(/type/i) &&
							  attr[i].value &&
							  attr[i].value.match(/application\/rss\+xml/i)) {
						type = "rss";
						possibility++;
					} else if(attr[i].name.match(/href/i) && attr[i].value) {
						href = attr[i].value.replace("&amp;", "&");
						possibility++;
					} else if(attr[i].name.match(/title/i)) {
						title = attr[i].value;
					}
				}
			}

			if((possibility == 3) && (href.length > 0)) {
				if(/^[a-z]{1,5}:/.test(href) === false) {	// relative URL
					if(/^\//.test(href)) {					// relative to server root
						href = this.url.replace(/(^[a-z]{1,5}:\/\/[^\/]*).*/, "$1") + href;
					} else {								// relative to document path
						href = this.url.replace(/(.*)\//, "$1") + "/" + href;
					}
				}

				this.items.push({
					type:	type,
					title:	title,
					url:	href
				});

				this.log("Found a feed, type:", type, " url:", href);
			}
		}
	},

	parseEndTag: function(tag) {
		if(tag.match(/head/i)) {
			this.$.parser.finished = true;
		}
	},

	parseCharacters: function(s) {},
	parseComment: function(s) {},

	componentsReady: function() {
		this.inherited(arguments);
		this.initialized = true;
	},

	create: function() {
		this.inherited(arguments);

		this.connectionAvailable = enyo.bind(this, this.connectionAvailable);
		this.connectionNotAvailable = enyo.bind(this, this.connectionNotAvailable);

		this.parserHandler = {
			startElement: 	enyo.bind(this, this.parseStartTag),
			endElement:		enyo.bind(this, this.parseEndTag),
			characters:		enyo.bind(this, this.parseCharacters),
			comment:		enyo.bind(this, this.parseComment)
		};
	}
});
