/*
 *		app/utils/formatting.js
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

var Formatting = {
	/**
	 * Strip CDATA tags from text.
	 * 
	 * @param {String} text			string containing CDATA tags
	 * @return {String}				string without CDATA tags
	 */
	stripCDATA: function(text) {
		return text.replace(/<\!\[CDATA\[(.*)\]\]/ig, "$1");		
	},
	
	/**
	 * Strip HTML tags from text.
	 * 
	 * @param {String} text			string containing HTML tags
	 * @return {String}				string without HTML tags
	 */
	stripHTML: function(text) {
        return text.replace(/(<([^>]+)>)/ig, "");
	},
	
	/** @private
	 * 
	 * Reformat a story's summary.
	 * 
	 * @param 	summary		{string}		string containing the summary to reformat
	 * @return 				{string}		reformatted summary
	 */
	reformatSummary: function(summary) {
		try {
			summary = this.stripCDATA(summary);
			
			// Remove potentially dangerous tags.
			summary = summary.replace(/<script[^>]*>(.*?)<\/script>/ig, "");
			summary = summary.replace(/(<script([^>]*)\/>)/ig, "");
			summary = summary.replace(/<iframe[^>]*>(.*?)<\/iframe>/ig, "");
			summary = summary.replace(/(<iframe([^>]+)\/>)/ig, "");
			
			summary = summary.replace(/(\{([^\}]+)\})/ig, "");
			summary = summary.replace(/digg_url .../, "");
			
			// Parse some BBCodes.
			summary = summary.replace(/\[i\](.*)\[\/i\]/ig, '<span class="italic">$1</span>');
			summary = summary.replace(/\[b\](.*)\[\/b\]/ig, '<span class="bold">$1</span>');
			summary = summary.replace(/\[u\](.*)\[\/u\]/ig, '<span class="underline">$1</span>');
			summary = unescape(summary);
		
			return summary;
		} catch(e) {
			Mojo.Log.logException(e, "FORMAT>");
		}
		return "";
	}
};
