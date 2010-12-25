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

var ril = Class.create({
	APIKey:				"5f1A6m56d6649k41a0p5d3dXg8T0w47f",
	credentialsWorking:	false,
	
	enabled: function(noCredentialCheck) {
		if(!prefs.rilUser || !prefs.rilPassword) {
			return false;
		} else if(noCredentialCheck) {
			return true;
		}
		
		return this.credentialsWorking;
	},
	
	checkCredentials: function(withFeedback) {
		if(!this.enabled(true)) {
			Mojo.Log.info("RIL> No credentials giving: RIL support disabled");
			this.credentialsWorking = false;
			return;
		}
	},
	
	/** @private
	 * 
	 * Check the internet connection status
	 *
	 * @param onSuccess		{function}	function to be called on success
	 * @param onFail		{function}	function to be called on failure
	 */	
	checkConnection: function(onSuccess, onFail) {
		Mojo.Log.info("RIL> requesting internet connection availability");
		this.connStatus = new Mojo.Service.Request('palm://com.palm.connectionmanager', {
			method: 'getstatus',
			parameters: {},
			onSuccess: this.getConnStatusSuccess.bind(this, onSuccess, onFail),
			onFailure: this.getConnStatusFailed.bind(this, onFail)
		});
	},
	
	/** @private
	 * 
	 * Called when the connection status could be retrieved.
	 *
	 * @param onSuccess		{function}	function to be called on success
	 * @param onFail		{function}	function to be called on failure
	 * @param result		{object}	information about the connection status
	 */	
	getConnStatusSuccess: function(onSuccess, onFail, result) {
		try {
			if(result.isInternetConnectionAvailable) {
				onSuccess();
			} else {
				Mojo.Log.info("RIL> no internet connection available");
				if(onFail) {
					onFail();
				}
			}
		} catch(e) {
			Mojo.Log.logException(e, "RIL>");
		}
	},
	
	/** @private
	 * 
	 * Called when the connection status could not be retrieved.
	 *
	 * @param onFail	{function}	function to be called on failure
	 * @param result	{object}	information about the connection status
	 */	
	getConnStatusFailed: function(onFail, result) {
		Mojo.Log.warn("RIL> Unable to determine connection status");
		if(onFail) {
			onFail();
		}
	},
	
	/**
	 * Add a URL to the list of unread items.
	 *
	 * @param url	{string}	url to add
	 */	
	addURL: function(url) {
		if(!this.enabled()) {
			return;
		}
	},
	
	/**
	 * Remove a URL from the list of unread items.
	 *
	 * @param url	{string}	url to add
	 */	
	removeURL: function(url) {
		if(!this.enabled()) {
			return;
		}
	}
});