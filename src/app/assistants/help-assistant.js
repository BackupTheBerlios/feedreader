/*
 *		app/assistants/help-assistant.js
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

function HelpAssistant() {
}

HelpAssistant.prototype.setup = function() {
	this.controller.setupWidget(Mojo.Menu.appMenu, { omitDefaultItems: true }, { visible: false });

	this.controller.get("help-title").update($LL("Help"));
	this.controller.get("appname").update(FeedReader.appName);
	this.controller.get("appdetails").update("v" + FeedReader.versionString + $L(" by ") + FeedReader.appAuthor);
	this.controller.get("copyright").update("&copy; Copyright " + FeedReader.appAuthor);

    this.controller.listen("web-contact", Mojo.Event.tap,
        				   this.supportWebTap.bindAsEventListener(this));
    this.controller.listen("email-contact", Mojo.Event.tap,
        				   this.supportEMailTap.bindAsEventListener(this));
};

HelpAssistant.prototype.cleanup = function(event) {
	FeedReader.feeds.save();
};

HelpAssistant.prototype.supportWebTap = function(event) {
	this.controller.serviceRequest("palm://com.palm.applicationManager", {
		method: "open",
		parameters: {
			id: "com.palm.app.browser",
			params: {
				target: "http://www.tegi-stuff.de"
			}
		}
	});
};

HelpAssistant.prototype.supportEMailTap = function(event) {
	this.controller.serviceRequest('palm://com.palm.applicationManager', {
		method: "open",
		parameters: {
			target: "mailto:timo@tegi-stuff.de?subject=FeedReader"
		}
	});	
};
