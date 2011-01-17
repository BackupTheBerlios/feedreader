/*
 *		app/models/readitlater.js - Read it Later support
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

var rilSupport = Class.create({
	credentialsWorking:	false,
	disabled:			false,
	prefs:				null,
	showAuthFeedback:	false,
	
	initialize: function(prefs) {
		this.prefs = prefs;
		
		this.noConnection = this.noConnection.bind(this);
		this.doCheckCredentials = this.doCheckCredentials.bind(this);
		this.credentialsDoWork = this.credentialsDoWork.bind(this);
		this.credentialsDoNotWork = this.credentialsDoNotWork.bind(this);
		this.urlAdded = this.urlAdded.bind(this);
		this.urlNotAdded = this.urlNotAdded.bind(this);
		this.urlRemoved = this.urlRemoved.bind(this);
		this.urlNotRemoved = this.urlNotRemoved.bind(this);
	},
	
	/**
	 * Check if Read it Later support is enabled.
	 *
	 * @param noCredentialCheck	{bool}	If true, the credential are not checked for validity
	 */	
	enabled: function(noCredentialCheck) {
		if((!this.prefs.rilUser) || (!this.prefs.rilPassword) || (this.disabled)) {
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
			var errorMsg = new Template($L("FeedReader encountered problems contacting '#{title}'. '#{title}' support has been disabled."));
			FeedReader.showError(errorMsg, { title: "Read it Later" });
		}
	},
	
	/**
	 * Check the given credentials for validity.
	 *
	 * @param withFeedback	{bool}	display error message if credentials are invalid
	 */	
	checkCredentials: function(withFeedback) {
		if(!this.enabled(true)) {
			Mojo.Log.info("RIL> No credentials given: RIL support disabled");
			this.credentialsWorking = false;
			return;
		}
		
		this.showAuthFeedback = withFeedback;
		Mojo.Log.info("RIL> checking", this.showAuthFeedback);
		FeedReader.connection.checkConnection(this.doCheckCredentials,
											  this.noConnection);
	},
	
	/** @private
	 *
	 * Called when internet connection is available to check the credentials.
	 */
	doCheckCredentials: function() {
		var parameters = new rilParameters(this.prefs);
		var requestOptions = {
			method:			"get",
			parameters:		parameters,
			evalJS:			false,
			evalJSON:		false,
			onSuccess:		this.credentialsDoWork,
			onFailure:		this.credentialsDoNotWork
		};
		var request = new Ajax.Request("https://readitlaterlist.com/v2/auth", requestOptions);
	},
	
	/** @private
	 *
	 * Called when the credential check returned a positive result.
	 */
	credentialsDoWork: function() {
		Mojo.Log.info("RIL> Credentials checked: working");
		this.credentialsWorking = true;
	},
	
	/** @private
	 *
	 * Called when the credential check returned an error.
	 */
	credentialsDoNotWork: function() {
		Mojo.Log.warn("RIL> Credentials checked: NOT working; showing feedback:", this.showAuthFeedback);
		this.credentialsWorking = false;
		if(this.showAuthFeedback) {
			var errorMsg = new Template($L("The provided '#{title}' credentials are wrong. '#{title}' support has been disabled."));
			FeedReader.showError(errorMsg, { title: "Read it Later" });
		}
	},
	
	/** @private
	 *
	 * Called when no connection is available.
	 */
	noConnection: function() {
		this.credentialsWorking = null;
		if(this.showAuthFeedback) {
			var errorMsg = new Template($L("The provided '#{title}' credentials could not be checked. '#{title}' support has been disabled."));
			FeedReader.showError(errorMsg, { title: "Read it Later" });
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
		
		Mojo.Log.info("RIL> Adding URL", url, "with title", title);
		FeedReader.connection.checkConnection(this.doAddURL.bind(this, title, url));
	},
	
	/** @private
	 *
	 * Called when internet connection is available to a URL.
	 */
	doAddURL: function(title, url) {
		var parameters = new rilParameters(this.prefs);
		parameters.title = title;
		parameters.url = url;
		
		var requestOptions = {
			method:			"get",
			parameters:		parameters,
			evalJS:			false,
			evalJSON:		false,
			onSuccess:		this.urlAdded,
			onFailure:		this.urlNotAdded
		};
		var request = new Ajax.Request("https://readitlaterlist.com/v2/add", requestOptions);		
	},

	/** @private
	 *
	 * Called when adding a url succeeded.
	 */	
	urlAdded: function() {
		Mojo.Log.info("RIL> URL successfully added");
	},

	/** @private
	 *
	 * Called when adding a url failed.
	 */	
	urlNotAdded: function(transport) {
		Mojo.Log.warn("RIL> URL could not be added, code", transport.status);
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

		Mojo.Log.info("RIL> Removing URL", url);
		FeedReader.connection.checkConnection(this.doRemoveURL.bind(this, url));
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

		Mojo.Log.info("RIL> Removing URLs");
		FeedReader.connection.checkConnection(this.doRemoveURLs.bind(this, urls));
	},
	
	/** @private
	 *
	 * Called when internet connection is available to remove a url.
	 */
	doRemoveURL: function(url) {
		var parameters = new rilParameters(this.prefs);
		parameters.read = Object.toJSON({
			"0": {
				"url": url
			}
		});
		
		var requestOptions = {
			method:			"get",
			parameters:		parameters,
			evalJS:			false,
			evalJSON:		false,
			onSuccess:		this.urlRemoved,
			onFailure:		this.urlNotRemoved
		};
		var request = new Ajax.Request("https://readitlaterlist.com/v2/send", requestOptions);				
	},
	
	/** @private
	 *
	 * Called when internet connection is available to remove a url list.
	 */
	doRemoveURLs: function(urls) {
		var parameters = new rilParameters(this.prefs);
		var list = "";
		var urlTemplate = new Template('"#{n}": { "url": "#{url}"}');
		
		for(var i = 0; i < urls.length; i++) {
			list += ((i > 0) ? ',' : '') + urlTemplate.evaluate({ n: i, url: urls[i].url });
		}
		parameters.read = "{" + list + "}";
		
		Mojo.Log.info(parameters.read);
		
		var requestOptions = {
			method:			"post",
			parameters:		parameters,
			evalJS:			false,
			evalJSON:		false,
			onSuccess:		this.urlRemoved,
			onFailure:		this.urlNotRemoved
		};
		var request = new Ajax.Request("https://readitlaterlist.com/v2/send", requestOptions);				
	},

	/** @private
	 *
	 * Called when a url has successfully been removed.
	 */
	urlRemoved: function() {
		Mojo.Log.info("RIL> URL successfully removed");
	},
	
	/** @private
	 *
	 * Called when removing a url did not succeed.
	 */
	urlNotRemoved: function(transport) {
		Mojo.Log.warn("RIL> URL could not be removed, code", transport.status);
		this.disable();
	}	
});