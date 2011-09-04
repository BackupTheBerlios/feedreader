/*
 *		source/controls/scrimspinner.js - A scrim with a large spinner
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
	name:		"ScrimSpinner",
	kind:		"Scrim",
	layoutKind: "VFlexLayout",
	align: 		"center",
	pack: 		"center",
	
	components:	[{
		name:	"spinner",
		kind:	"SpinnerLarge"
	}],

	show: function() {
		this.inherited(arguments);
		this.$.spinner.show();
	},
	
	hide: function() {
		this.$.spinner.hide();
		this.inherited(arguments);
	}
});
