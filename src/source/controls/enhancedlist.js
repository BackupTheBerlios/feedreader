/*
 *		source/controls/enhancedlist.js - Improved VirtualList
 *
 *		This control makes page handling a lot easier. It keeps track
 *		of currently running 'acquirePage' events and automatically refreshes
 *		the list once all are done.
 *		To simplify list updates, the method 'reAcquirePages' can be used. It
 *		avoids flicker as it refreshes the list after all data has been acquired.
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
	name:	"EnhancedList",
	kind:	"ReorderableVirtualList",

	updateCounter:	0,

	events: {
		onAcquirePage: 		"",
		onDiscardPage: 		"",
		onFinishReAcquire:	""	// fired when all pages have been acquired
	},

	/**
	 * Re-acquire all pages currently loaded.
	 */
	reAcquirePages: function() {
		for(var i = this.$.buffer.top; i <= this.$.buffer.bottom; i++) {
			this._discardPage(this, i);
			this._acquirePage(this, i);
		}
	},

	/** @private
	 * Custom acquire handler.
	 */
	_acquirePage: function(sender, index) {
		this.updateCounter++;
		this.doAcquirePage(index);
	},

	/**
	 * Call this, once a page has been acquired. Once all pages requested
	 * are acquired, the list will automatically be refreshed.
	 */
	acquiredPage: function(page) {
		this.updateCounter--;
		if(this.updateCounter == 0) {
			// It seems, this needs to be executed asynchronously...
			enyo.asyncMethod(this, function() {
				this.refresh();
			});
			this.doFinishReAcquire();
		}
	},

	/** @private
	 * Custom discard handler.
	 */
	_discardPage: function(sender, index) {
		this.doDiscardPage(index);
	},

	/** @protected
	 * Overriden to change some events, so we get notified about acquiring and
	 * discarding of pages.
	 */
	initComponents: function() {
		this.inherited(arguments);

		this.$.scroller.onScroll = "_scrolled";

		// Connect page handling events.
		this.$.buffer.onAcquirePage = "_acquirePage";
		this.$.buffer.onDiscardPage = "_discardPage";
	},

	/**
	 * Returns the top page of the display buffer.
	 */
	getTopPage: function() {
		return this.$.buffer.top;
	},

	/**
	 * Returns the bottom page of the display buffer.
	 */
	getBottomPage: function() {
		return this.$.buffer.bottom;
	},

	/**
	 * Returns the top item index of the display buffer.
	 */
	getTopItemIndex: function() {
		return (this.$.buffer.top * this.getPageSize());
	},

	/**
	 * Returns the bottom item index of the display buffer.
	 */
	getBottomItemIndex: function() {
		return ((this.$.buffer.bottom + 1) * this.getPageSize() - 1);
	},

	/**
	 * Scroll to top.
	 */
	scrollToTop: function() {
		this.$.scroller.$.scroll.setScrollPosition(0);
		this.$.scroller.$.scroll.doScroll();
	}
});
