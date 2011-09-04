/*
 *		source/controls/selectoritem.js
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
	name:		"SelectorItem",
	kind:		"RowItem",
	layoutKind:	"HFlexLayout",
	align:		"center",
	
	components:	[{
		name:		"caption",
		className:	"enyo-label"
	}, {
		name:			"selector",
		kind:			"ListSelector",
		contentPack:	"end",
		flex:			1
	}],
	
	published:	[{
		caption:	"",
		items:		[],
		value:		0
	}],
	
	captionChanged: function() {
		this.$.caption.setContent(this.caption);
	},
	
	itemsChanged: function() {
		this.$.selector.setItems(this.items);
	},
	
	getValue: function() {
		return this.$.selector.getValue();
	},
	
	setValue: function(value) {
		this.$.selector.setValue(value);
	},
	
	create: function() {
		this.inherited(arguments);
		
		this.captionChanged();
		this.itemsChanged();
		this.setValue(this.value);
	}
});