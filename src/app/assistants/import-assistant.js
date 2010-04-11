/*
 *		app/assistants/import-assistant.js
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

function ImportAssistant(feeds) {
	this.feeds = feeds;
	
	this.htmlparser = new SimpleHtmlParser();
	
	this.parserHandler = {
		startElement: 	this.parseStartTag.bind(this),
		endElement:		this.parseEndTag.bind(this),
		characters:		this.parseCharacters.bind(this),
		comment:		this.parseComment.bind(this)
	};
	
	this.feedList = [];
	this.connStatus = {};
	
	this.loadingSpinnerAttribs = {
		spinnerSize: "large"
	};
	this.loadingSpinnerModel = {
		spinning: false
	};
	
	this.importModeModel = {
		value: 0,
		disabled: true
	};
	
	this.inHeader = false;
	
	this.searchForFeedsHandler = this.searchForFeeds.bind(this);
	this.getConnStatusSuccessHandler = this.getConnStatusSuccess.bind(this);
	this.getConnStatusFailedHandler = this.getConnStatusFailed.bind(this);
	this.ajaxRequestSuccessHandler = this.ajaxRequestSuccess.bind(this);
	this.ajaxRequestFailedHandler = this.ajaxRequestFailed.bind(this);
	
	this.addFeedHandler = this.addFeed.bindAsEventListener(this);
}

ImportAssistant.prototype.setup = function() {
	this.controller.setupWidget("loading-spinner", this.loadingSpinnerAttribs,
								this.loadingSpinnerModel);

	this.controller.setupWidget("importURL",
								{ hintText: $L("Enter URL here"), autoFocus: true, limitResize: true,
								  autoReplace: false, textCase: Mojo.Widget.steModeLowerCase, enterSubmits: false },
								this.urlModel = { value: "" });

	this.controller.setupWidget("importMode", {
		label: $L("Mode"),
        choices: [
            { label: $L("From a Website"),	value: 0 },
            { label: $L("From OPML"),		value: 1 }		
		]},
		this.importModeModel);

	this.controller.get("import-title").update($L("Import feeds"));
	this.controller.get("import-group-title").update($L("Source"));
	this.controller.get("importURL-title").update($L("URL"));
	
	this.searchButton = this.controller.get("searchButton");
	this.controller.setupWidget("searchButton", { type: Mojo.Widget.defaultButton },
								this.okButtonModel = {
									label: $L("Search for feeds"),
									disabled: false
								});
	this.controller.listen("searchButton", Mojo.Event.tap, this.searchForFeeds.bindAsEventListener(this));
	
	this.controller.setupWidget("importList", {
        itemTemplate:	"import/importRowTemplate", 
        listTemplate:	"import/importListTemplate", 
        swipeToDelete:	false,
        renderLimit: 	40,
        reorderable:	false
    },
    this.importListModel = {
		items: this.feedList
	});
	
    this.controller.listen("importList", Mojo.Event.listTap, this.addFeedHandler);	
};

ImportAssistant.prototype.activate = function(event) {
};

ImportAssistant.prototype.deactivate = function(event) {
};

ImportAssistant.prototype.cleanup = function(event) {
};

ImportAssistant.prototype.showScrim = function(visible) {
	this.loadingSpinnerModel.spinning = visible;
	this.controller.get("load-scrim").className = "palm-scrim" + (visible ? "" : " hidden");
	this.controller.modelChanged(this.loadingSpinnerModel);
	
	this.importListModel.items = this.feedList;
	this.controller.modelChanged(this.importListModel);

	this.controller.get("feedList-container").className = this.feedList.length > 0 ? "" : "hidden";
};

ImportAssistant.prototype.searchForFeeds = function(event) {
	this.feedList.splice(0, this.feedList.length);
	this.showScrim(true);
	
    if(/^[a-z]{1,5}:/.test(this.urlModel.value) === false) {
        this.urlModel.value = this.urlModel.value.replace(/^\/{1,2}/, "");                                
        this.urlModel.value = "http://" + this.urlModel.value;
		this.controller.modelChanged(this.urlModel);
    }
	
	this.connStatus = new Mojo.Service.Request('palm://com.palm.connectionmanager', {
		method: 'getstatus',
		parameters: {},
		onSuccess: this.getConnStatusSuccessHandler,
		onFailure: this.getConnStatusFailedHandler
	});		
};

ImportAssistant.prototype.getConnStatusSuccess = function(result) {
	if(result.isInternetConnectionAvailable) {
		Mojo.Log.info("Scanning url", this.urlModel.value);
		var request = new Ajax.Request(this.urlModel.value, {
				method: "get",
				evalJS: "false",
				evalJSON: "false",
				onSuccess: this.ajaxRequestSuccessHandler,
				onFailure: this.ajaxRequestFailedHandler});
	} else {
		this.controller.get("conn-status").update($L("No internet connection."));
		this.showScrim(false);
	}
};

ImportAssistant.prototype.getConnStatusFailed = function(result) {
	this.controller.get("conn-status").update($L("No internet connection."));
	this.showScrim(false);
};

ImportAssistant.prototype.ajaxRequestSuccess = function(transport) {
	if(transport.responseText && transport.responseText.length > 0) {
		Mojo.Log.info("Got response from web!");
		try {
			this.htmlparser.parse(transport.responseText.replace("/<script.*<\/script>/ig"), this.parserHandler);
		} catch(e) {
			Mojo.Log.logException(e);
		}
	} else {
		Mojo.Log.info("No data retrieved.");		
	}
	
	this.controller.get("conn-status").update("");
	this.showScrim(false);
};

ImportAssistant.prototype.ajaxRequestFailed = function(transport) {
	this.controller.get("conn-status").update($L("Unable to retrieve data."));
	this.showScrim(false);	
};

ImportAssistant.prototype.parseStartTag = function(tag, attr) {
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
			if(attr[i]) {
				if(attr[i].name.match(/rel/i) &&
				   attr[i].value.match(/alternate/i)) {
					possibility++;
				} else if(attr[i].name.match(/type/i) &&
						  attr[i].value.match(/application\/atom\+xml/i)) {
					type = "atom";
					possibility++;
				} else if(attr[i].name.match(/type/i) &&
						  attr[i].value.match(/application\/rss\+xml/i)) {
					type = "rss";
					possibility++;
				} else if(attr[i].name.match(/href/i)) {
					href = attr[i].value.replace(/^\//, "");
					possibility++;
				} else if(attr[i].name.match(/title/i)) {
					title = attr[i].value;
				}
			}
		}
		
		if((possibility == 3) && (href.length > 0)) {
		    if(/^[a-z]{1,5}:/.test(href) === false) {
				href = this.urlModel.value.replace(/$\//, "") + "/" + href;
			}
			
			this.feedList.push({
				type: type,
				title: title,
				url: href
			});
			Mojo.Log.info("Found a feed, type:", type, " url:", href);
		}
	}
};

ImportAssistant.prototype.parseEndTag = function(tag) {
	if(tag.match(/head/i)) {
		this.htmlparser.finished = true;
	}
};

ImportAssistant.prototype.parseCharacters = function(s) {
};

ImportAssistant.prototype.parseComment = function(s) {
};

ImportAssistant.prototype.addFeed = function(event) {
	var itemIndex = this.feedList.indexOf(event.item);
	var title = new Template($L("Subscribe to feed #{title}?"));
	
	this.controller.showAlertDialog({
		onChoose: this.doAddFeed.bind(this, itemIndex, this.feedList[itemIndex]),
		title: title.evaluate(this.feedList[itemIndex]),
		choices: [
			{
				label: $L("Subscribe"),
				value: "add",
				type: "affirmative"
			}, {
				label: $LL("Cancel"),
				value: "cancel",
				type: "negative"				
			}
		]
	});
};

ImportAssistant.prototype.doAddFeed = function(index, feed, value) {
	if(value == "add") {
		this.feeds.addFeed(feed.title, feed.url, true, 1, true, true, 0, true);
		this.feedList.splice(index, 1);
		this.importListModel.items = this.feedList;
		this.controller.modelChanged(this.importListModel);
	}
};