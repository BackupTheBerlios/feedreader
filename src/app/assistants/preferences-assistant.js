/*
 *		app/assistants/preferences-assistant.js
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

function PreferencesAssistant() {
	this.prefs = FeedReader.prefs;
}

PreferencesAssistant.prototype.setup = function() {
	this.controller.get("prefs-title").update($L("FeedReader Preferences"));
	this.controller.get("prefs-updating-group-title").update($L("Automatic updating"));
	this.controller.get("prefs-appearance-group-title").update($L("Summary appearance"));
	
	this.controller.get("notify-title").update($L("Show notification"));
	this.controller.get("wake-device-title").update($L("Wake device"));
	this.controller.get("largeFont-title").update($L("Use large fonts"));
	
	this.controller.setupWidget("notificationEnabled",
    							{ property: "value", trueLabel: $L("Yes"), falseLabel: $L("No")}, 
         						this.notificationModel = {value: this.prefs.notificationEnabled, disabled: false});
	this.controller.setupWidget("wakingEnabled",
    							{ property: "value", trueLabel: $L("Yes"), falseLabel: $L("No")}, 
         						this.wakingModel = {value: this.prefs.wakingEnabled, disabled: false});
	this.controller.setupWidget("updateInterval", {
		label: $L("Interval"),
		choices: [
			{ label: $L("Manual Updates"),	value: 0},
			{ label: $L("5 Minutes"),		value: 5},    
			{ label: $L("15 Minutes"),		value: 15},
			{ label: $L("30 Minutes"),		value: 30},    
			{ label: $L("1 Hour"),			value: 60},    
			{ label: $L("4 Hours"),			value: 240},
			{ label: $L("1 Day"),			value: 1440}
		]    
	}, this.updateIntervalModel = { value : this.prefs.updateInterval });
	
	this.controller.setupWidget("feedTitleColor", {
		label: $L("Title color"),
		choices: [
			{ label: $L("Black"),   value: "black" },
			{ label: $L("Red"),		value: "red" },
			{ label: $L("Green"),	value: "green" },
			{ label: $L("Blue"),	value: "blue" },
			{ label: $L("Yellow"),	value: "yellow" },
			{ label: $L("Purple"),	value: "purple" }
		]    
	}, this.titleColorModel = { value : this.prefs.titleColor });

	this.controller.setupWidget("largeFont", {
		property: "value",
		trueLabel: $L("Yes"),
		falseLabel: $L("No")
	}, this.largeFontModel = {
		value: this.prefs.largeFont,
		disabled: false
	});

	this.controller.setupWidget("summaryLength", {
		label: $L("Length"),
		choices: [
			{ label: $L("100 characters"),	value: 100},
			{ label: $L("120 characters"),	value: 120},    
			{ label: $L("150 characters"),	value: 150},
			{ label: $L("200 characters"),	value: 200},
			{ label: $L("250 characters"),	value: 250}
		]    
	}, this.summaryLengthModel = { value : this.prefs.summaryLength });
};

PreferencesAssistant.prototype.cleanup = function(event) {
	this.prefs.notificationEnabled = this.notificationModel.value;
	this.prefs.wakingEnabled = this.wakingModel.value;
	this.prefs.updateInterval = this.updateIntervalModel.value;
	this.prefs.titleColor = this.titleColorModel.value;
	this.prefs.summaryLength = this.summaryLengthModel.value;
	
	this.prefs.save();
};
