/*
 *		source/utils/connection.js - Internet connection checking
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

	name:	"ConnectionChecker",
	kind:	"Component",

	components:	[{
		name:		"connectionService",
		kind:		"PalmService",
		service:	"palm://com.palm.connectionmanager/",
		method:		"getstatus",
		onSuccess:	"getConnStatusSuccess",
		onFailure:	"getConnStatusFailed"
	}],

	/**
	 * Check the internet connection status
	 *
	 * @param onSuccess		{function}	function to be called on success
	 * @param onFail		{function}	function to be called on failure
	 */
	checkConnection: function(onSuccess, onFail) {
		onFail = onFail || this.defaultOnFail;
		this.$.connectionService.call({}, {
			onSuccessHandler: onSuccess,
			onFailureHandler: onFail
		});
	},

	/** @private
	 *
	 * Called when the connection status could be retrieved.
	 *
	 * @param sender		{object}	sender (the service)
	 * @param result		{object}	result object
	 * @param request		{object}	information about the request
	 */
	getConnStatusSuccess: function(sender, result, request) {
		try {
			if(result.isInternetConnectionAvailable) {
				request.onSuccessHandler();
			} else {
				request.onFailureHandler();
			}
		} catch(e) {
			this.error("CONN EXCEPTION>", e);
		}
	},

	/** @private
	 *
	 * Called when the connection status could not be retrieved.
	 *
	 * @param sender		{object}	sender (the service)
	 * @param result		{object}	result object
	 * @param request		{object}	information about the request
	 */
	getConnStatusFailed: function(sender, result, request) {
		try {
			this.warn("CONN> Unable to determine connection status");
			request.onFailureHandler();
		} catch(e) {
			this.error("CONN EXCEPTION>", e);
		}
	},

	/** @private
	 *
	 * Default onFail-Handler.
	 */
	defaultOnFail: function() {
	}
});
