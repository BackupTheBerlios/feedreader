/*
 *		app/assistants/app-assistant.js
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

/**
 * Global object that contains various global variables and some
 * utility functions. It also contains the main model (feeds).
 */
FeedReader = {
	appName:			"FeedReader",
	appAuthor:			"Timo Tegtmeier",
	versionString:		"2.1.3",
	versionInt:			21,
	copyrightYears:		"2009-2011",

	mainStageName: 		"FeedReaderStage",
	dashboardStageName:	"FeedReaderDashboard",
	
	isActive: 			false,
	showChangeLog:		false,
	
	connection:			null,
	feeds:				null,
	prefs: 				null,
	ril:				null,
	mediaExtensionLib:	null,
	
	controller:			{},
	
	scrimMode:			false,	// Set to true, if a new scrim screenshot is needed
	
	/**
	 * Show an alert.
	 * 
	 * @param {Template} 	message
	 * @param {Hash} 		values
	 */
	showError: function(message, values) {
		var appController = Mojo.Controller.getAppController();
	    var cardStageController = appController.getStageController(this.mainStageName);
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
	},
	
	/**
	 *
	 * Send a SMS
	 *
	 * @param {String}		Body of the sms
	 */
	sendSMS: function(text) {
		var req = new Mojo.Service.Request("palm://com.palm.applicationManager", {
			   method: "open",
			   parameters: {
				   id: "com.palm.app.messaging",
				   params: {
					   messageText: text
				   }
			   }
		});
	},
	
	/**
	 *
	 * Send an E-Mail
	 *
	 * @param {String}		Subject line
	 * @param {String}		Body of the E-Mail
	 */
	sendEMail: function(subject, text) {
		var req = new Mojo.Service.Request("palm://com.palm.applicationManager", {
			   method: "open",
			   parameters:  {
				   id: "com.palm.app.email",
				   params: {
					summary:	subject,
					text:		text
				}
			}
		});
	},
	
	/**
	 * Get media extension library.
	 *
	 * @return	{Object}			media extension library
	 */
	getMediaExtensionLib: function() {
		if(!this.mediaExtensionLib) {
			this.mediaExtensionLib = MojoLoader.require({
				name: 		"mediaextension",
				version:	"1.0"
			});
		}
		return this.mediaExtensionLib;
	}
};

/**
 * Constructor for the AppAssistant.
 * The AppAssistant has global lifetime.
 * 
 * @param {Object} appController
 */
function AppAssistant (appController) {
	FeedReader.connection = new connectionChecker();
	FeedReader.prefs = new prefs();
	FeedReader.ril = new rilSupport(FeedReader.prefs);
	FeedReader.prefs.load();
	FeedReader.feeds = new feeds();
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
			if(FeedReader.prefs.enableRotation) {
				cardStageController.setWindowOrientation("free");
			}
            cardStageController.popScenesTo("feedlist");    
            cardStageController.activate();
        } else {
            this.controller.createStageWithCallback({name: FeedReader.mainStageName, lightweight: true}, 
                									function(stageController) {
														stageController.enableManualSplashScreenMode();
														if(FeedReader.prefs.enableRotation) {
															stageController.setWindowOrientation("free");
														}
														stageController.pushScene("feedlist", FeedReader.feeds);
													},
													"card");
        }
    } else {
        switch (launchParams.action) {
			case "feedUpdate":
				Mojo.Log.info("scheduled feed update");
				FeedReader.prefs.setTimer();
				if(FeedReader.feeds.isReady() && !FeedReader.feeds.isUpdating()) {
					FeedReader.feeds.enqueueUpdateAll();
				} else {
					FeedReader.feeds.updateWhenReady = true;
				}
				break;
        
			case "bannerPressed":
				if (cardStageController) {
					if(FeedReader.prefs.enableRotation) {
						cardStageController.setWindowOrientation("free");
					}
					if(cardStageController.topScene().sceneName != "feedlist") {
						cardStageController.popScenesTo("feedlist");
					}
					cardStageController.activate();
				} else {
	                this.controller.createStageWithCallback({
						name: FeedReader.mainStageName,
						lightweight: true
					}, function(stageController) {
						stageController.enableManualSplashScreenMode();
						if(FeedReader.prefs.enableRotation) {
							stageController.setWindowOrientation("free");
						}
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
				case "do-import":
					stageController.pushScene("import", FeedReader.feeds);
					break;
				
                case "do-about":
					var t = new Template($L("#{appName} — v#{version}"));
					var m = new Template($L("Copyright #{years} #{author}, published under the terms of the GNU GPL v3. See License for details."));
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
                    stageController.pushAppSupportInfoScene();
                	break;
            
                case "do-feedUpdate":
                    FeedReader.feeds.enqueueUpdateAll();
                	break;
            }
        }
    }
};

AppAssistant.prototype.considerForNotification = function(params){
};
