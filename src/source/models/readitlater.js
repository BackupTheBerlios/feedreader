/*
 *		source/models/readitlater.js - Read it Later support
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

/* Basic class for AJAX paramaters */
function rilParameters(prefs) {
	this.username = prefs.rilUser;
	this.password = prefs.rilPassword;
	this.apikey = "5f1A6m56d6649k41a0p5d3dXg8T0w47f";
}

enyo.kind({
	
	name:				"RILService",
	kind:				"Component",
	
	credentialsWorking:	false,
	disabled:			false,
	showAuthFeedback:	false,
	
	addURL:				"https://readitlaterlist.com/v2/add",
	sendURL:			"https://readitlaterlist.com/v2/send",
	authURL:			"https://readitlaterlist.com/v2/auth",

	events:				{
		onError:		""
	},

	components:			[{
		name:			"webService",
		kind:			"WebService",
		handleAs:		"xml"
	}],
	
	create: function() {
		this.inherited(arguments);
		this.noConnection = enyo.bind(this, this.noConnection);
		this.doCheckCredentials = enyo.bind(this, this.doCheckCredentials);
	},
	
	/**
	 * Check if Read it Later support is enabled.
	 *
	 * @param noCredentialCheck	{bool}	If true, the credential are not checked for validity
	 */	
	enabled: function(noCredentialCheck) {
		if((!enyo.application.prefs.rilUser) ||
		   (!enyo.application.prefs.rilPassword) ||
		   (this.disabled)) {
			return false;
		} else if(noCredentialCheck) {
			return true;
		}		
		return this.credentialsWorking;
	},
	
	/**
	 */
	disable: function() {
		if(!this.disabled) {
			this.disabled = true;
			this.doError("FeedReader encountered problems contacting '{$title}'. '{$title}' support has been disabled.",
						 { title: "Read it Later" });
		}
	},
	
	/**
	 * Check the given credentials for validity.
	 *
	 * @param withFeedback	{bool}	display error message if credentials are invalid
	 */	
	checkCredentials: function(withFeedback) {
		if(!this.enabled(true)) {
			this.log("RIL> No credentials given: RIL support disabled");
			this.credentialsWorking = false;
			return;
		}
		
		this.showAuthFeedback = withFeedback;
		this.log("RIL> checking", this.showAuthFeedback);
		enyo.application.connChecker.checkConnection(this.doCheckCredentials,
													 this.noConnection);
	},
	
	/** @private
	 *
	 * Called when internet connection is available to check the credentials.
	 */
	doCheckCredentials: function() {
		this.$.webService.call(new rilParameters(enyo.application.prefs), {
			url:		this.authURL,
			method:		"get",
			onSuccess:	"credentialsDoWork",
			onFailure:	"credentialsDoNotWork"
		});
	},
	
	/** @private
	 *
	 * Called when the credential check returned a positive result.
	 */
	credentialsDoWork: function() {
		this.log("RIL> Credentials checked: working");
		this.credentialsWorking = true;
	},
	
	/** @private
	 *
	 * Called when the credential check returned an error.
	 */
	credentialsDoNotWork: function() {
		this.warn("RIL> Credentials checked: NOT working; showing feedback:", this.showAuthFeedback);
		this.credentialsWorking = false;
		if(this.showAuthFeedback) {
			this.doError($L("The provided '{$title}' credentials are wrong. '{$title}' support has been disabled."),
						 { title: "Read it Later" });
		}
	},
	
	/** @private
	 *
	 * Called when no connection is available.
	 */
	noConnection: function() {
		this.credentialsWorking = null;
		if(this.showAuthFeedback) {
			this.doError($L("The provided '{$title}' credentials could not be checked. '{$title}' support has been disabled."),
						 { title: "Read it Later" });
		}
	},
	
	/**
	 * Add a URL to the list of unread items.
	 *
	 * @param title	{string}	title
	 * @param url	{string}	url to add
	 */	
	addURL: function(title, url) {
		if(!this.enabled()) {
			return;
		}
		
		this.log("RIL> Adding URL", url, "with title", title);
		enyo.application.connChecker.checkConnection(enyo.bind(this, "doAddURL", title, url));
	},
	
	/** @private
	 *
	 * Called when internet connection is available to a URL.
	 */
	doAddURL: function(title, url) {
		var parameters = new rilParameters(enyo.application.prefs);
		parameters.title = title;
		parameters.url = url;

		this.$.webService.call(parameters, {
			url:			this.addURL,
			method:			"get",
			onSuccess:		"urlAdded",
			onFailure:		"urlNotAdded"
		});
	},

	/** @private
	 *
	 * Called when adding a url succeeded.
	 */	
	urlAdded: function() {
		this.log("RIL> URL successfully added");
	},

	/** @private
	 *
	 * Called when adding a url failed.
	 */	
	urlNotAdded: function(sender, response, transport) {
		this.warn("RIL> URL could not be added, code", transport.xhr.status);
		this.disable();
	},
	
	/**
	 * Remove a URL from the list of unread items.
	 *
	 * @param url	{string}	url to remove
	 */	
	removeURL: function(url) {
		if(!this.enabled()) {
			return;
		}

		this.log("RIL> Removing URL", url);
		enyo.application.connChecker.checkConnection(enyo.bind(this, this.doRemoveURL, url));
	},

	/**
	 * Remove a list of URLs from the list of unread items.
	 *
	 * @param urls	{array}	list of urls
	 */	
	removeURLs: function(urls) {
		if(!this.enabled()) {
			return;
		}

		this.log("RIL> Removing URLs");
		enyo.application.connChecker.checkConnection(enyo.bind(this.doRemoveURLs, urls));
	},
	
	/** @private
	 *
	 * Called when internet connection is available to remove a url.
	 */
	doRemoveURL: function(url) {
		var parameters = new rilParameters(enyo.application.prefs);
		parameters.read = '{ "0": {	"url": "' + url + '"} }';

		this.$.webService.call(parameters, {
			url:			this.sendURL,
			method:			"post",
			onSuccess:		"urlRemoved",
			onFailure:		"urlNotRemoved"
		});	
	},
	
	/** @private
	 *
	 * Called when internet connection is available to remove a url list.
	 */
	doRemoveURLs: function(urls) {
		var parameters = new rilParameters(enyo.application.prefs);
		var list = "";
		var urlTemplate = new Template();
		
		for(var i = 0; i < urls.length; i++) {
			list += ((i > 0) ? ',' : '')
			     + enyo.maroize('"{$n}": { "url": "{$url}"}',
								{ n: i, url: urls[i].url });
		}
		parameters.read = "{" + list + "}";
		this.$.webService.call(parameters, {
			url:			this.sendURL,
			method:			"get",
			onSuccess:		"urlRemoved",
			onFailure:		"urlNotRemoved"
		});				
	},

	/** @private
	 *
	 * Called when a url has successfully been removed.
	 */
	urlRemoved: function() {
		this.log("RIL> URL successfully removed");
	},
	
	/** @private
	 *
	 * Called when removing a url did not succeed.
	 */
	urlNotRemoved: function(sender, response, transport) {
		this.warn("RIL> URL could not be removed, code", transport.xhr.status);
		this.disable();
	}	
});