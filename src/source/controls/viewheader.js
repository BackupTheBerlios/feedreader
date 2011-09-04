/*
 *		source/viewheader.js - universal header with icon
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
	name:		"ViewHeader",
	kind:		"Header",

	components:	[{
		kind:		"HFlexBox",
		components:	[{
			name:		"iconBox",
			nodeTag:	"div",
			className:	"feed-infobox",
			components:	[{
				kind:	"Image",
				name:	"headerIcon",
				style:	"max-width: 40px; max-height: 40px;"
			}, {
				name:		"unreadBadge",
				className:	"feed-unreaditem",
				components:	[{
					name:		"unreadCount",
					className:	"feed-countlabel",
					content:	"0"
				}]
			}, {
				name:		"newBadge",
				className:	"feed-newitem",
				components:	[{
					name:		"newCount",
					className:	"feed-countlabel",
					content:	"0"								
				}]
			}]
		}]
	}, {
		layoutKind:	"VFlexLayout",
		components:	[{
			name:		"headerTitle"
		}, {
			name:		"headerSubTitle",
			className:	"enyo-item-secondary"
		}]
	}],
	
	published:	{
		title:			"",
		subTitle:		"",
		icon:			"",
		unreadCount:	-1,
		newCount:		-1
	},
	
	titleChanged: function() {
		this.$.headerTitle.setContent(this.title);
	},
	
	subTitleChanged: function() {
		this.$.headerSubTitle.setContent(this.subTitle);
	},
	
	iconChanged: function() {
		this.$.headerIcon.setSrc(this.getIcon());
	},
	
	unreadCountChanged: function() {
		if(this.unreadCount < 0) {
			this.$.unreadBadge.hide();
		} else {
			this.$.unreadCount.setContent(this.unreadCount);
			this.$.unreadBadge.show();
		}
	},
	
	newCountChanged: function() {
		if(this.newCount < 0) {
			this.$.newBadge.hide();
		} else {
			this.$.newCount.setContent(this.newCount);
			this.$.newBadge.show();
		}
	},
	
	create: function() {
		this.inherited(arguments);
		
		this.iconChanged();
		this.titleChanged();
		this.subTitleChanged();
		
		this.unreadCountChanged();
		this.newCountChanged();
	}
});