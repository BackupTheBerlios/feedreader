/*
 *		source/help/help.js - Help dialog
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
	name:			"HelpDialog",
	kind:			"ModalDialog",
	layoutKind:		"VFlexLayout",
	contentHeight:	"100%",
//	style:			"width: 500px; height: 85%; min-height: 500px;",

	components:	[{
		content:	enyo.application.appName + ' v' + enyo.application.versionString,
		style:		"font-weight: bold; font-size: 18px; margin-bottom: 0px;"
	}, {
		content:	$L("by") + " " + enyo.application.appAuthor,
		style:		"font-weight: bold; font-size: 15px;"
	}, {
		kind:		"RowGroup",
		caption:	$L("Help"),
		components:	[{
			kind:		"HFlexBox",
			align:		"center",
			onclick:	"openFeedReaderHomepage",
			components:	[{
				kind:		"Image",
				src:		"../../images/web-icon.png",
				style:		"margin-right: 15px"
			}, {
				flex:		1,
				content:	$L("FeedReader's Homepage")
			}]
		}]
	}, {
		kind:		"RowGroup",
		caption:	$L("Support"),
		components:	[{
			kind:		"HFlexBox",
			align:		"center",
			onclick:	"openHomepage",
			components:	[{
				kind:		"Image",
				src:		"../../images/web-icon.png",
				style:		"margin-right: 15px"
			}, {
				flex:		1,
				content:	$L("Homepage")
			}]
		}, {
			kind:		"HFlexBox",
			align:		"center",
			onclick:	"openEMail",
			components:	[{
				kind:		"Image",
				src:		"../../images/mail-icon.png",
				style:		"margin-right: 15px"
			}, {
				flex:		1,
				content:	$L("Write an E-Mail")
			}]
		}]
	}, {
		kind:		"Button",
		className:	"enyo-button-affirmative",
		caption:	$L("OK"),
		onclick:	"okClicked"
	}],

	openFeedReaderHomepage: function(sender, event) {
		enyo.application.openLink("http://www.tegi-stuff.de/doku.php?id=feedreader");
	},

	openHomepage: function(sender, event) {
		enyo.application.openLink("http://www.tegi-stuff.de/");
	},

	openEMail: function(sender, event) {
		enyo.application.openLink("mailto:general@tegi-stuff.de?subject=FeedReader");
	},

	okClicked: function(sender, event) {
		this.close();
	}
});
