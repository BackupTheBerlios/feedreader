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
		onFinishReAcquire:	""
	},

	reAcquirePages: function() {
		for(var i = this.$.buffer.top; i <= this.$.buffer.bottom; i++) {
			this._discardPage(this, i);
			this._acquirePage(this, i);
		}
	},

	_acquirePage: function(sender, index) {
		this.updateCounter++;
		this.doAcquirePage(index);
	},

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

	_discardPage: function(sender, index) {
		this.doDiscardPage(index);
	},

	initComponents: function() {
		this.inherited(arguments);
		this.$.buffer.onAcquirePage = "_acquirePage";
		this.$.buffer.onDiscardPage = "_discardPage";
	}
});
