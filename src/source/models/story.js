/*
 *		source/models/story.js - Story data model
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

Story.prototype.id = 0;
Story.prototype.fid = 0;
Story.prototype.uuid = "";
Story.prototype.title = "";
Story.prototype.summary = "";
Story.prototype.picture = "";
Story.prototype.audio = "";
Story.prototype.video = "";
Story.prototype.isRead = false;
Story.prototype.isNew = false;
Story.prototype.isStarred = false;
Story.prototype.pubdate = 0;
Story.prototype.flag = false;
Story.prototype.deleted = false;

/**
 * Create a new Story.
 *
 * @param	proto		{object}		story object to clone
 */
function Story(proto) {
	if(proto.feedType) {
		this.feedType = proto.feedType;
	}
	if(proto.feedTitle) {
		this.feedTitle = proto.feedTitle;
	}

	this.id = proto.id;
	this.fid = proto.fid;
	this.uuid = proto.uuid;
	this.title = proto.title;
	this.summary = proto.summary;
	this.picture = proto.picture;
	this.audio = proto.audio;
	this.video = proto.video;
	this.isRead = proto.isRead;
	this.isNew = proto.isNew;
	this.isStarred = proto.isStarred;
	this.pubdate = proto.pubdate;
	this.flag = proto.flag;
	this.deleted = proto.deleted;
}
