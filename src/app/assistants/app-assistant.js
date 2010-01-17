/*
 *		app/assistants/app-assistant.js
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

/**
 * Global object that contains various global variables and some
 * utility functions. It also contains the main model (feeds).
 */
FeedReader = {
	appName:			"FeedReader",
	appAuthor:			"Timo Tegtmeier",
	versionString:		"1.1",
	copyrightYears:		"2009, 2010",

	mainStageName: 		"FeedReaderStage",
	
	isActive: 			false,
	
	menuAttr: {},
	menuModel: {
    	visible: true,
    	items: [ 
        	{ label: $L("About FeedReader"), command: "do-about" },
			{ label: $L("License"), command: "do-license" }
//        	{ label: $L("Update all Feeds"), checkEnabled: true, command: "do-feedUpdate" }
    	]
	},
	
	feeds: {},
	prefs: {},
	
	controller: {},
	
	/**
	 * Show an alert.
	 * 
	 * @param {Template} message
	 * @param {Hash} values
	 */
	showError: function(message, values) {
	    var cardStageController = this.controller.getStageController(this.mainStageName);
		if (!cardStageController) {
			return;
		}
		
		var topScene = cardStageController.topScene();
		if (!topScene) {
			return;
		}
	
		topScene.showAlertDialog({
			title: $LL("Error"),
			message: message.evaluate(values),
			onChoose: undefined,
			choices: [{
				label: $LL("OK")
			}]
		});
	}
};

/**
 * Constructor for the AppAssistant.
 * The AppAssistant has global lifetime.
 * 
 * @param {Object} appController
 */
function AppAssistant (appController) {
	FeedReader.prefs = new prefs();
	FeedReader.prefs.load();
	
	FeedReader.feeds = new feeds();
	FeedReader.feeds.load();
}

/**
 * Setup function for the AppAssistant.
 */
AppAssistant.prototype.setup = function() {	
	FeedReader.prefs.setTimer();
};

/**
 * Handle the app launch.
 * 
 * @param {Object} launchParams
 */
AppAssistant.prototype.handleLaunch = function (launchParams) {
    Mojo.Log.info("ReLaunch requested");

	FeedReader.controller = this.controller;
    var cardStageController = this.controller.getStageController(FeedReader.mainStageName);
    var appController = Mojo.Controller.getAppController();
    
    if (!launchParams) {
        if (cardStageController) {
            cardStageController.popScenesTo("feedlist");    
            cardStageController.activate();
        } else {
            this.controller.createStageWithCallback({name: FeedReader.mainStageName, lightweight: true}, 
                									function(stageController) {
														stageController.pushScene("feedlist", FeedReader.feeds);
													},
													"card");
        }
    } else {
        switch (launchParams.action) {
			case "feedUpdate":
				Mojo.Log.info("scheduled feed update");
				FeedReader.prefs.setTimer();
				FeedReader.feeds.update();
				break;
        
			case "bannerPressed":
				if (cardStageController) {
				    cardStageController.popScenesTo("feedlist");
				} else {
	                this.controller.createStageWithCallback({
						name: FeedReader.mainStageName,
						lightweight: true
					}, function(stageController) {
	                	stageController.pushScene("feedlist", FeedReader.feeds);
	                }, "card");        
	            }
				break;
		}
	}
};

/**
 * Handle the various menu commands.
 * 
 * @param {Object} event
 */
AppAssistant.prototype.handleCommand = function(event) {    
    var stageController = this.controller.getActiveStageController();
    var currentScene = stageController.activeScene();
    
    if (event.type == Mojo.Event.commandEnable) {
        if (FeedReader.feeds.updateInProgress && (event.command == "do-feedUpdate")) {
            event.preventDefault();
        } else if((event.command == Mojo.Menu.helpCmd) || (event.command == Mojo.Menu.prefsCmd)) {
			event.stopPropagation();
		}
    } else {
        if(event.type == Mojo.Event.command) {
            switch(event.command) {
                case "do-about":
					var t = new Template($L("#{appName} — v#{version}"));
					var m = new Template($L("Copyright #{years} #{author}, published under the terms of the GNU GPL v2. See License for details."));
                    currentScene.showAlertDialog({
                            onChoose: function(value) {},
                            title:  t.evaluate({
								appName: FeedReader.appName,
								version: FeedReader.versionString
							}), 
                            message: m.evaluate({
								years: FeedReader.copyrightYears,
								author: FeedReader.appAuthor
							}),
                            choices:[{ label:$LL("OK"), value:"" }]});
                	break;
                
				case "do-license":
					stageController.pushScene("license");
					break;
				
                case Mojo.Menu.prefsCmd:
                    stageController.pushScene("preferences");
                	break;
                
                case Mojo.Menu.helpCmd:
                    stageController.pushScene("help");
                	break;
            
                case "do-feedUpdate":
                    FeedReader.feeds.update();
                	break;
            }
        }
    }
};
