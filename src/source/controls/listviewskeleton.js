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

	lastSelIndex:	-1,
	selectedIndex:	-1,
	selectedId:		-1,
	deletedItem:	null,

	refreshInProgress:	false,

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

	deselectRow: function(index) {
		if(index === undefined) {
			index = this.selectedIndex;
		}

		if(index >= 0) {
			this.$.list.getSelection().clear();
			this.$.list.prepareRow(index);
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

		this.acquireData(this.filter, offset, count, enyo.bind(this, this.insertItems, page));
	},

	discardPage: function(sender, page) {
		// Do not discard pages currently visible to avoid flicker.
		if((page < this.$.list.getTopPage()) || (page > this.$.list.getBottomPage())) {
			this.log("DISCARDING page", page);

			var count = this.$.list.getPageSize();
			var offset = count * page;

			for(var i = offset; i < offset + count; i++) {
				this.items[i] = null; // delete items
			}
		}
	},

	finishReAcquire: function(sender) {
		this.refreshInProgress = false;
		if(this.selectedId < 0) {
			// nothing to do
			return;
		}

		// Scan the items for the selected item; its position might have changed.
		for(var i = 0; i < this.items.length; i++) {
			if(this.items[i] && (this.items[i].id == this.selectedId)) {
				this.selectRow(i);
				break;
			}
		}

		// Check if we couldn't find the item. If not, reset the item highlighting.
		if(this.selectedIndex < 0) {
			this.log(this.kindName, "LVS> Couldn't find selected item! Deselecting", this.lastSelIndex);
			this.deselectRow(this.lastSelIndex);
		}

		this.selectedId = -1;
		this.lastSelIndex = -1;
	},

	itemClicked: function(sender, event) {
		if(event.rowIndex == this.selectedIndex) {
			return false;
		}

		this.selectRow(event.rowIndex);
		return true;
	},

	itemDeleted: function(sender, index) {
		var delSelected = this.selectedIndex == index;
		if(delSelected) {
			this.selectedIndex = -1;
		}

		this.deletedItem = this.items[index];
		this.items.splice(index, 1);
		this.$.list.refresh(); // Provide quick visual response.

		return delSelected;
	},

	//
	// Database interaction
	//

	setItemCount: function(count) {
		this.itemCount = count;
	},

	insertItems: function(page, offset, items) {
		try {
			var count = offset + this.$.list.getPageSize();
			for(var i = offset; i < count; i++) {
				if(i - offset >= items.length) {
					this.items[i] = null;
				} else {
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
		if(this.refreshInProgress) {
			return;
		} else {
			this.refreshInProgress = true;
		}

		// Remember selected id
		this.selectedId = this.selectedIndex >= 0 ? this.items[this.selectedIndex].id : -1;
		this.lastSelIndex = this.selectedIndex;

		// Reset internal data.
		this.itemCount = -1;
		this.selectedIndex = -1;

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
