/*
 *		app/models/spooler.js - activity spooler
 */

/* FeedReader - A RSS Feed Aggregator for Palm WebOS
 * Copyright (C) 2009, 2010 Timo Tegtmeier
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
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

var spooler = new Class.create({
	list: [],
	
	initialize: function() {
	},
	
	addAction: function(action) {
		this.list.push({ execute: action });
		if(this.list.length == 1) {
			this.nextAction();
		}
	},
	
	nextAction: function() {
		if(this.list.length >= 1) {
			this.list.shift().execute();			
		}
	}
});