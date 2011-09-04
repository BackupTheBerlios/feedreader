/*
 *		source/controls/listviewskeleton.js
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
	name:			"ListViewSkeleton",
	kind:			"VFlexBox",
	flex:			1,
	
	items:			[],
	itemCount:		-1,
	filter:			"",
	
	selectedIndex:	-1,

	//
	// List handling
	//
	
	selectRow: function(index) {
		this.deselectRow();
		this.$.list.select(index);
		this.$.list.prepareRow(index);
		this.$.item.addClass("enyo-item-selected");
		this.selectedIndex = index;
	},
	
	deselectRow: function() {
		if(this.selectedIndex >= 0) {
			this.$.list.getSelection().clear();			
			this.$.list.prepareRow(this.selectedIndex);
			this.$.item.removeClass("enyo-item-selected");
			this.selectedIndex = -1;
		}
	},
	
	acquirePage: function(sender, page) {
		var count = this.$.list.getPageSize();
		var offset = count * page;
				
		// If we have the total count, check it first.
		if((this.itemCount >= 0) && (offset + count <= this.itemCount)) {
			this.$.list.acquiredPage(page);
			return;
		}
		
		// Check if we already have the data.
		if((this.items.length <= offset) || (!this.items[offset])) {
			this.acquireData(this.filter, offset, count, enyo.bind(this, this.insertItems, page));
		} else {
			this.$.list.acquiredPage(page);
		}
	},
	
	discardPage: function(sender, page) {
		var count = this.$.list.getPageSize();
		var offset = count * page;
		
		for(var i = offset; i < offset + count; i++) {
			this.items[i] = null; // delete items
		}
	},
	
	itemClicked: function(sender, event) {
		this.selectRow(event.rowIndex);
	},
	
	itemDeleted: function(sender, index) {
		if(this.selectedIndex == index) {
			this.index = -1;
			return true;
		}
		return false;
	},
	
	//
	// Database interaction
	//
	
	setItemCount: function(count) {
		this.itemCount = count;
	},

	insertItems: function(page, offset, items) {
		try {
			if(items.length > 0) {
				var count = offset + items.length;
				for(var i = offset; i < count; i++) {
					this.items[i] = items[i - offset];
				}
			}
			this.$.list.acquiredPage(page);
		} catch(e) {
			this.error("LV EXCEPTION>", e);
		}
	},
	
	//
	// Public functions
	//
	
	refresh: function() {
		// Reset internal data.
		this.itemCount = -1;
		
		// And now refresh the list.
		this.updateCount(this.setItemCount);
		this.$.list.reAcquirePages();
	},
	
	clear: function() {
		this.itemCount = -1;
		this.items = [];
		this.filter = "";
		this.selectedIndex = -1;
		this.$.list.punt();
	},
	
	//
	// Initialization
	//
	
	create: function() {
		this.inherited(arguments);
		
		this.setItemCount = enyo.bind(this, this.setItemCount);
	}
});