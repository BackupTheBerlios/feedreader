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

enyo.kind({
	name:				"RILService",
	kind:				"Component",

	credentialsWorking:	false,
	disabled:			false,
	showAuthFeedback:	false,

	kAddURL:			"https://readitlaterlist.com/v2/add",
	kSendURL:			"https://readitlaterlist.com/v2/send",
	kAuthURL:			"https://readitlaterlist.com/v2/auth",

	components:			[{
		name:			"webService",
		kind:			"WebService",
		handleAs:		"text"
	}, {
		name:			"connChecker",
		kind:			"ConnectionChecker"
	}],

	/** @private
	 *
	 * Returns a new RIL parameter block including the private API key.
	 */
	getParametersBlock: function() {
		return ({
			username:	enyo.application.prefs.rilUser,
			password:	enyo.application.prefs.rilPassword,
			apikey:		"5f1A6m56d6649k41a0p5d3dXg8T0w47f"
		});
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

	/** @private
	 *
	 * Called to disable RIL support due to errors.
	 */
	disable: function() {
		if(!this.disabled) {
			this.disabled = true;
			enyo.application.showError("FeedReader encountered problems contacting '{$title}'. '{$title}' support has been disabled.",
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
		this.$.connChecker.checkConnection(enyo.bind(this, this.doCheckCredentials),
										   enyo.bind(this, this.noConnection));
	},

	/** @private
	 *
	 * Called when internet connection is available to check the credentials.
	 */
	doCheckCredentials: function() {
		this.log("RIL> Have connection; now checking credentials");
		this.$.webService.call(this.getParametersBlock(), {
			url:		this.kAuthURL,
			method:		"GET",
			onSuccess:	"credentialsDoWork",
			onFailure:	"credentialsDoNotWork"
		});
	},

	/** @private
	 *
	 * Called when the credential check returned a positive result.
	 */
	credentialsDoWork: function(sender, response) {
		this.log("RIL> Credentials checked: working");
		this.credentialsWorking = true;
	},

	/** @private
	 *
	 * Called when the credential check returned an error.
	 */
	credentialsDoNotWork: function(sender, response, request) {
		this.warn("RIL> Credentials checked: NOT working; showing feedback:", this.showAuthFeedback);
		this.credentialsWorking = false;
		if(this.showAuthFeedback) {
			enyo.application.showError($L("The provided '{$title}' credentials are wrong. '{$title}' support has been disabled."),
									   { title: "Read it Later" });
		}
	},

	/** @private
	 *
	 * Called when no connection is available.
	 */
	noConnection: function() {
		this.log("RIL> no connection => no credential check");
		this.credentialsWorking = null;
		if(this.showAuthFeedback) {
			enyo.application.showError($L("The provided '{$title}' credentials could not be checked. '{$title}' support has been disabled."),
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
		this.$.connChecker.checkConnection(enyo.bind(this, this.doAddURL, title, url), enyo.application.nop);
	},

	/** @private
	 *
	 * Called when internet connection is available to a URL.
	 */
	doAddURL: function(title, url) {
		this.log("RIL> Adding URL", url, "with title", title);

		var parameters = this.getParametersBlock();
		parameters.title = title;
		parameters.url = url;

		this.$.webService.call(parameters, {
			url:			this.kAddURL,
			method:			"GET",
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
		this.$.connChecker.checkConnection(enyo.bind(this, this.doRemoveURL, url));
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
		this.$.connChecker.checkConnection(enyo.bind(this, this.doRemoveURLs, urls));
	},

	/** @private
	 *
	 * Called when internet connection is available to remove a url.
	 */
	doRemoveURL: function(url) {
		var parameters = this.getParametersBlock();
		parameters.read = '{ "0": {	"url": "' + url + '"} }';

		this.$.webService.call(parameters, {
			url:			this.kSendURL,
			method:			"POST",
			onSuccess:		"urlRemoved",
			onFailure:		"urlNotRemoved"
		});
	},

	/** @private
	 *
	 * Called when internet connection is available to remove a url list.
	 */
	doRemoveURLs: function(urls) {
		var parameters = this.getParametersBlock();
		var list = "";

		for(var i = 0; i < urls.length; i++) {
			list += ((i > 0) ? ',' : '')
			     + enyo.macroize('"{$n}": { "url": "{$url}"}',
								 { n: i, url: urls[i].url });
		}
		parameters.read = "{" + list + "}";
		this.$.webService.call(parameters, {
			url:			this.kSendURL,
			method:			"POST",
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
