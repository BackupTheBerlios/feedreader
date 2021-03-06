/*
 *		app/assistants/preferences-assistant.js
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

function PreferencesAssistant() {
	this.prefs = FeedReader.prefs;
}

PreferencesAssistant.prototype.setup = function() {
	SceneControl.beginSceneSetup(this, false);

	this.controller.get("prefs-title").update($L("FeedReader Preferences"));
	this.controller.get("prefs-general-group-title").update($L("General"));
	this.controller.get("prefs-updating-group-title").update($L("Automatic updating"));
	this.controller.get("prefs-notify-group-title").update($L("Notifications"));
	this.controller.get("prefs-appearance-group-title").update($L("Summary appearance"));
	this.controller.get("prefs-ril-group-title").update($L("Read it Later"));
	this.controller.get("prefs-ril-note").update($L("If you provide 'Read it Later' credentials, FeedReader will sync starred items to 'Read it Later'."));

	this.controller.get("notify-title").update($L("Show notification"));
	this.controller.get("notify-sound-title").update($L("Play sound on new stories"));
	this.controller.get("blinking-title").update($L("Blink on new stories"));
	this.controller.get("notifyRunning-title").update($L("Notify when running, but not in main scene"));

	this.controller.get("updateOnStart-title").update($L("Update on start"));
	this.controller.get("wake-device-title").update($L("Wake device"));
	this.controller.get("left-handed-title").update($L("Navigation on left side"));
	this.controller.get("enableRotation-title").update($L("Auto-rotate screen"));
	this.controller.get("largeFont-title").update($L("Use large fonts"));

	this.controller.setupWidget("leftHanded",
    							{ property: "value", trueLabel: $L("Yes"), falseLabel: $L("No")},
         						this.leftHandedModel = {value: this.prefs.leftHanded, disabled: false});
	this.controller.setupWidget("enableRotation",
    							{ property: "value", trueLabel: $L("Yes"), falseLabel: $L("No")},
         						this.enableRotationModel = {value: this.prefs.enableRotation, disabled: false});

	this.controller.setupWidget("notificationEnabled",
    							{ property: "value", trueLabel: $L("Yes"), falseLabel: $L("No")},
         						this.notificationModel = {value: this.prefs.notificationEnabled, disabled: false});
	this.controller.setupWidget("blinkingEnabled",
    							{ property: "value", trueLabel: $L("Yes"), falseLabel: $L("No")},
         						this.blinkingModel = {value: this.prefs.blinkingEnabled, disabled: false});
	this.controller.setupWidget("notifySoundEnabled",
    							{ property: "value", trueLabel: $L("Yes"), falseLabel: $L("No")},
         						this.notifySoundModel = {value: this.prefs.notifyWithSound, disabled: false});
	this.controller.setupWidget("notifyWhileRunning",
    							{ property: "value", trueLabel: $L("Yes"), falseLabel: $L("No")},
         						this.notifyWhileRunningModel = {value: this.prefs.notifyWhileRunning, disabled: false});

	this.controller.setupWidget("updateOnStart",
    							{ property: "value", trueLabel: $L("Yes"), falseLabel: $L("No")},
         						this.updateOnStartModel = {value: this.prefs.updateOnStart, disabled: false});
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
			{ label: $L("2 Hours"),			value: 120},
			{ label: $L("4 Hours"),			value: 240},
			{ label: $L("8 Hours"),			value: 480},
			{ label: $L("12 Hours"),		value: 720},
			{ label: $L("1 Day"),			value: 1440}
		]
	}, this.updateIntervalModel = { value : this.prefs.updateInterval });
	this.controller.setupWidget("storyKeepTime", {
		label: $L("Keep stories"),
		choices: [
			{ label: $L("1 Day"),			value: 24},
			{ label: $L("2 Days"),			value: 24 * 2},
			{ label: $L("3 Days"),			value: 24 * 3},
			{ label: $L("5 Days"),			value: 24 * 5},
			{ label: $L("1 Week"),			value: 24 * 7},
			{ label: $L("2 Weeks"),			value: 24 * 7 * 2},
			{ label: $L("4 Weeks"),			value: 24 * 7 * 4}
		]
	}, this.storyKeepTimeModel = { value : this.prefs.storyKeepTime });

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

	this.controller.setupWidget("rilUser",
								{ hintText: $L("Username"), limitResize: true, autoReplace: true,
								  textCase: Mojo.Widget.steModeLowerCase, enterSubmits: false },
								this.rilUserModel = { value: this.prefs.rilUser });
	this.controller.setupWidget("rilPassword",
								{ hintText: $L("Password"), limitResize: true,
								  textCase: Mojo.Widget.steModeLowerCase, enterSubmits: false },
								this.rilPasswordModel = { value: this.prefs.rilPassword });

	this.controller.setInitialFocusedElement(null);

	SceneControl.endSceneSetup(this);
};

PreferencesAssistant.prototype.cleanup = function(event) {
	this.prefs.notificationEnabled = this.notificationModel.value;
	this.prefs.blinkingEnabled = this.blinkingModel.value;
	this.prefs.notifyWhileRunning = this.notifyWhileRunningModel.value;
	this.prefs.notifyWithSound = this.notifySoundModel.value;
	this.prefs.wakingEnabled = this.wakingModel.value;
	this.prefs.updateInterval = this.updateIntervalModel.value;
	this.prefs.updateOnStart = this.updateOnStartModel.value;
	this.prefs.titleColor = this.titleColorModel.value;
	this.prefs.summaryLength = this.summaryLengthModel.value;
	this.prefs.largeFont = this.largeFontModel.value;
	this.prefs.leftHanded = this.leftHandedModel.value;
	this.prefs.enableRotation = this.enableRotationModel.value;
	this.prefs.storyKeepTime = this.storyKeepTimeModel.value;
	this.prefs.rilUser = this.rilUserModel.value;
	this.prefs.rilPassword = this.rilPasswordModel.value;

	this.prefs.save(true);

    var cardStageController = Mojo.Controller.getAppController().getStageController(FeedReader.mainStageName);
	if(cardStageController) {
		if(this.prefs.enableRotation) {
			cardStageController.setWindowOrientation("free");
		} else {
			cardStageController.setWindowOrientation("up");
		}
	}
};
