/*
 *		app/assistants/import-assistant.js
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

function ImportAssistant() {
	this.htmlparser = new SimpleHtmlParser();
	
	this.parserHandler = {
		startElement: 	this.parseStartTag.bind(this),
		endElement:		this.parseEndTag.bind(this),
		characters:		this.parseCharacters.bind(this),
		comment:		this.parseComment.bind(this)
	};
};

ImportAssistant.prototype.setup = function() {
	
	this.controller.get("import-title").update($L("Import feeds"));
};

ImportAssistant.prototype.activate = function(event) {
};

ImportAssistant.prototype.deactivate = function(event) {
};

ImportAssistant.prototype.cleanup = function(event) {
};

ImportAssistant.prototype.parseStartTag = function(tag, attr) {
	if(tag.toLower().match(/link/)) {
		
	}
};

ImportAssistant.prototype.parseEndTag = function(tag) {
};

ImportAssistant.prototype.parseCharacters = function(s) {
};

ImportAssistant.prototype.parseComment = function(s) {
};