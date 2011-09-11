/*
 *		source/preferences/preferences.js
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
	name:			"Preferences",
	kind:			"VFlexBox",

	events:	{
		onPrefsSaved:	""
	},

	components:	[{
		kind:		"Toolbar",
		content:	$L("Preferences"),
		className:	"enyo-toolbar-light"
	}, {
		kind:		"Scroller",
		flex:		1,

		components:	[{
			kind:		"VFlexBox",
			align:		"center",
			components:	[{
				kind:		"RowGroup",
				caption:	$L("Automatic updating"),
				className:	"prefs-rowgroup",
				components:	[{
					name:		"updateInterval",
					kind:		"SelectorItem",
					caption:	$L("Update interval"),
					onChange:	"updateIntervalChanged",
					items:	[
						{	caption:	$L("Manual updates"),	value:		0 },
						{	caption:	$L("5 Minutes"),		value:		5 },
						{	caption:	$L("15 Minutes"),		value:		15 },
						{	caption:	$L("30 Minutes"),		value:		30 },
						{	caption:	$L("1 Hour"),			value:		60 },
						{	caption:	$L("2 Hours"),			value:		120 },
						{	caption:	$L("4 Hours"),			value:		240 },
						{	caption:	$L("8 Hours"),			value:		480	},
						{	caption:	$L("12 Hours"),			value:		720	},
						{	caption:	$L("1 Day"),			value:		1440 }
					]
				}, {
					name:		"wakingEnabled",
					kind:		"ToggleItem",
					caption:	$L("Wake device for updating")
				}, {
					name:		"updateOnStart",
					kind:		"ToggleItem",
					caption:	$L("Update on app start")
				}, {
					name:		"storyKeepTime",
					kind:		"SelectorItem",
					caption:	$L("Keep stories for"),
					items:	[
						{ 	caption: 	$L("1 Day"),			value: 24 },
						{ 	caption: 	$L("2 Days"),			value: 24 * 2 },
						{ 	caption: 	$L("3 Days"),			value: 24 * 3 },
						{ 	caption: 	$L("5 Days"),			value: 24 * 5 },
						{ 	caption: 	$L("1 Week"),			value: 24 * 7 },
						{ 	caption: 	$L("2 Weeks"),			value: 24 * 7 * 2 },
						{ 	caption: 	$L("4 Weeks"),			value: 24 * 7 * 4 }
					]
				}]
			}, {
				kind:		"RowGroup",
				caption:	$L("Notifications"),
				className:	"prefs-rowgroup",
				components:	[{
					name:		"notificationEnabled",
					kind:		"ToggleItem",
					caption:	$L("Show notifications on new stories"),
					onChange:	"notificationEnabledChanged"
				}, {
					name:		"unobtrusiveNotifications",
					kind:		"ToggleItem",
					caption:	$L("Show notifications unobtrusively")
				}, {
					name:		"blinkingEnabled",
					kind:		"ToggleItem",
					caption:	$L("Make LED Throbber blink on new stories")
				}, {
					name:		"notifyWhileRunning",
					kind:		"ToggleItem",
					caption:	$L("Show when running in background")
				}]
			}, {
				kind:		"RowGroup",
				caption:	$L("Miscellaneous"),
				className:	"prefs-rowgroup",
				components:	[{
					name:		"titleColor",
					kind:		"SelectorItem",
					caption:	$L("Title color"),
					items:	[
						{	caption:	$L("Black"),   	value: "black" },
						{	caption:	$L("Red"),		value: "red" },
						{	caption:	$L("Green"),	value: "green" },
						{	caption:	$L("Blue"),		value: "blue" },
						{	caption:	$L("Yellow"),	value: "yellow" },
						{	caption:	$L("Purple"),	value: "purple" }
					]
				}, {
					name:		"largeFonts",
					kind:		"ToggleItem",
					caption:	$L("Use large fonts")
				}, {
					name:		"summaryLength",
					kind:		"SelectorItem",
					caption:	$L("Summary length in story list"),
					items:	[
						{	caption:	$L("100 characters"),	value: 100 },
						{	caption:	$L("120 characters"),	value: 120 },
						{	caption:	$L("150 characters"),	value: 150 },
						{	caption: 	$L("200 characters"),	value: 200 },
						{	caption:	$L("250 characters"),	value: 250 }
					]
				}]
			}, {
				kind:		"RowGroup",
				caption:	$L("Read It Later"),
				className:	"prefs-rowgroup",
				components:	[{
					name:	"rilUsername",
					kind:	"Input",
					hint:	$L("User name")
				}, {
					name:	"rilPassword",
					kind:	"PasswordInput",
					hint:	$L("Password")
				}]
			}, {
				className:	"enyo-paragraph enyo-subtext prefs-rowgroup",
				content:	$L("If you provide <i>Read it Later</i> credentials, FeedReader will sync starred items to <i>Read it Later</i>.")
			}]
		}]
	}, {
		kind:		"Toolbar",
		components:	[{
			kind:		"ToolButton",
			content:	$L("Back"),
			onclick:	"savePrefs"
		}, {
			kind:		"Spacer"
		}]
	}],

	updateIntervalChanged: function() {
		var autoUpdateEnabled = this.$.updateInterval.getValue() > 0;
		this.$.wakingEnabled.setDisabled(!autoUpdateEnabled);
	},

	notificationEnabledChanged: function() {
		var notificationEnabled = this.$.notificationEnabled.getValue();
		this.$.unobtrusiveNotifications.setDisabled(!notificationEnabled);
		this.$.notifyWhileRunning.setDisabled(!notificationEnabled);
		this.$.blinkingEnabled.setDisabled(!notificationEnabled);
	},

	savePrefs: function() {
		enyo.application.prefs.updateInterval = this.$.updateInterval.getValue();
		enyo.application.prefs.storyKeepTime = this.$.storyKeepTime.getValue();
		enyo.application.prefs.updateOnStart = this.$.updateOnStart.getValue();

		enyo.application.prefs.notificationEnabled = this.$.notificationEnabled.getValue();
		enyo.application.prefs.blinkingEnabled = this.$.blinkingEnabled.getValue();
		enyo.application.prefs.notifyWhileRunning = this.$.notifyWhileRunning.getValue();
		enyo.application.prefs.unobtrusiveNotifications = this.$.unobtrusiveNotifications.getValue();
		enyo.application.prefs.wakingEnabled = this.$.wakingEnabled.getValue();

		enyo.application.prefs.titleColor = this.$.titleColor.getValue();
		enyo.application.prefs.summaryLength = this.$.summaryLength.getValue();
		enyo.application.prefs.largeFont = this.$.largeFonts.getValue();

		enyo.application.prefs.rilUser = this.$.rilUsername.getValue();
		enyo.application.prefs.rilPassword = this.$.rilPassword.getValue();

		enyo.application.prefs.save();
		this.doPrefsSaved();
	},

	create: function() {
		this.inherited(arguments);

		this.$.updateInterval.setValue(enyo.application.prefs.updateInterval);
		this.$.storyKeepTime.setValue(enyo.application.prefs.storyKeepTime);
		this.$.updateOnStart.setValue(enyo.application.prefs.updateOnStart);

		this.$.notificationEnabled.setValue(enyo.application.prefs.notificationEnabled);
		this.$.blinkingEnabled.setValue(enyo.application.prefs.blinkingEnabled);
		this.$.notifyWhileRunning.setValue(enyo.application.prefs.notifyWhileRunning);
		this.$.unobtrusiveNotifications.setValue(enyo.application.prefs.unobtrusiveNotifications);
		this.$.wakingEnabled.setValue(enyo.application.prefs.wakingEnabled);

		this.$.titleColor.setValue(enyo.application.prefs.titleColor);
		this.$.summaryLength.setValue(enyo.application.prefs.summaryLength);
		this.$.largeFonts.setValue(enyo.application.prefs.largeFont);

		this.$.rilUsername.setValue(enyo.application.prefs.rilUser);
		this.$.rilPassword.setValue(enyo.application.prefs.rilPassword);

		this.updateIntervalChanged();
		this.notificationEnabledChanged();
	}
});
