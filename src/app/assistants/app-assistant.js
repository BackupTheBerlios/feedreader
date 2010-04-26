/*
 *		app/assistants/app-assistant.js
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

/**
 * Global object that contains various global variables and some
 * utility functions. It also contains the main model (feeds).
 */
FeedReader = {
	appName:			"FeedReader",
	appAuthor:			"Timo Tegtmeier",
	versionString:		"1.3.0",
	versionInt:			6,
	copyrightYears:		"2009, 2010",

	mainStageName: 		"FeedReaderStage",
	dashboardStageName:	"FeedReaderDashboard",
	
	isActive: 			false,
	showChangeLog:		false,
	
	menuAttr: {},
	menuModel: {
    	visible: true,
    	items: [ 
        	{ label: $L("About FeedReader"), command: "do-about" },
			{ label: $L("Import feeds"), command: "do-import" },
			{ label: $L("License"), command: "do-license" }
    	]
	},
	
	feeds: {},
	prefs: {},
	
	controller: {},
	
	/**
	 * Show an alert.
	 * 
	 * @param {Template} 	message
	 * @param {Hash} 		values
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
	},
	
	/**
	 * Called to indicate that a scene is beginning its setup.
	 * This will initialize the App Menu if desired.
	 * 
	 * @param {Object}		Scene assistant
	 * @parsm {Boolean}		Whether the app menu shall be initialized
	 */
	beginSceneSetup: function(caller, initAppMenu) {
		if(caller.controller) {
			// Setup application menu.
			if(initAppMenu) {
				caller.controller.setupWidget(Mojo.Menu.appMenu, FeedReader.menuAttr, FeedReader.menuModel);
			}
		}		

		if(caller.setupComplete !== undefined) {
			caller.setupComplete = false;
		}
	},
	
	/**
	 * Called to indicate that a scene has finished its setup.
	 * 
	 * @param {Object}		Scene assistant
	 */
	endSceneSetup: function(caller) {
		if(caller.setupComplete !== undefined) {
			caller.setupComplete = true;
			if(caller.setupFinished !== undefined) {
				Mojo.Log.info("FEEDREADER> setup finished; enabling transition");
				caller.setupFinished();
			}
		}
	},
	
	/**
	 * Called to indicate that a scene is about to activate.
	 * 
	 * @param {Object}		Scene assistant
	 * @param {Function}	callback provided by webOS
	 */
	aboutToActivate: function(caller, callback) {
		if((caller.setupComplete === undefined)|| caller.setupComplete) {
			Mojo.Log.info("FEEDREADER> setup already completed; enabling transition");
			callback();
		} else {
			caller.setupFinished = callback;
		}
	},
	
	/**
	 *
	 * Show a notification
	 *
	 * @param {Int}		Count of new stories
	 */
	postNotification: function(count) {
		if(!count) {	// nothing new or undefined.
			return;
		}
		var appController = Mojo.Controller.getAppController();
		var dashboardStageController = appController.getStageProxy(this.dashboardStageName);
		
		if(!dashboardStageController) {
			appController.createStageWithCallback({
				name: this.dashboardStageName,
				lightweight: true
			}, function(stageController) {
				stageController.pushScene("dashboard", count);			
			}, "dashboard");
		} else {
			dashboardStageController.delegateToSceneAssistant("updateDashboard", count);
		}
	},
	
	/**
	 *
	 * WebOS 1.4+ doesn't allow headless apps to run longer than 15 seconds
	 * without an open stage. Therefore we use the dashboard stage to indicate
	 * a scheduled update.
	 *
	 * Open the update dashboard.
	 * 
	 */
	createUpdateDashboard: function(force) {
		var appController = Mojo.Controller.getAppController();
		var mainStageController = appController.getStageProxy(this.mainStageName);
		var dashboardStageController = appController.getStageProxy(this.dashboardStageName);
		
		if(mainStageController && (force === undefined)) {
			return;
		}
		
		if(!dashboardStageController) {
			appController.createStageWithCallback({
				name: this.dashboardStageName,
				lightweight: true
			}, function(stageController) {
				stageController.pushScene("dashboard", -1);
			}, "dashboard");
		} else {
			dashboardStageController.delegateToSceneAssistant("updateDashboard", -1);
		}
	},
	
	/**
	 *
	 * WebOS 1.4+ doesn't allow headless apps to run longer than 15 seconds
	 * without an open stage. Therefore we use the dashboard stage to indicate
	 * a scheduled update.
	 *
	 * Close the update dashboard.
	 *
	 */
	removeUpdateDashboard: function() {
		var appController = Mojo.Controller.getAppController();
		var dashboardStageController = appController.getStageProxy(this.dashboardStageName);
		
		if(dashboardStageController) {
			dashboardStageController.delegateToSceneAssistant("updateDashboard", -2);
		}
	},

	/**
	 * Remove the application splash screen.
	 */	
	hideSplash: function() {
		var cardStageController = Mojo.Controller.getAppController().getStageController(this.mainStageName);
		if(cardStageController) {
			Mojo.Log.info("FEEDREADER> Main stage exist, removing splash screen");
			cardStageController.hideSplashScreen();
		}
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
	 * Strip CDATA tags from text.
	 * 
	 * @param {String} text			string containing CDATA tags
	 * @return {String}				string without CDATA tags
	 */
	stripCDATA: function(text) {
		return text.replace(/<\!\[CDATA\[(.*)\]\]/ig, "$1");		
	},
	
	/**
	 * Strip HTML tags from text.
	 * 
	 * @param {String} text			string containing HTML tags
	 * @return {String}				string without HTML tags
	 */
	stripHTML: function(text) {
        return text.replace(/(<([^>]+)>)/ig, "");
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
			cardStageController.setWindowOrientation("free");
            cardStageController.popScenesTo("feedlist");    
            cardStageController.activate();
        } else {
            this.controller.createStageWithCallback({name: FeedReader.mainStageName, lightweight: true}, 
                									function(stageController) {
														stageController.enableManualSplashScreenMode();
														stageController.setWindowOrientation("free");
														stageController.pushScene("feedlist", FeedReader.feeds);
													},
													"card");
        }
    } else {
        switch (launchParams.action) {
			case "feedUpdate":
				Mojo.Log.info("scheduled feed update");
				FeedReader.prefs.setTimer();
				FeedReader.feeds.enqueueUpdate(-1);
				break;
        
			case "bannerPressed":
				if (cardStageController) {
					cardStageController.setWindowOrientation("free");
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
						stageController.setWindowOrientation("free");
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
                    FeedReader.feeds.enqueueUpdate(-1);
                	break;
            }
        }
    }
};

AppAssistant.prototype.considerForNotification = function(params){
	if(params) {
		switch(params.type) {
			case "feedlist-loaded":
				Mojo.Log.info("APPASSISTANT> Feed list loaded; removing splash");
				FeedReader.hideSplash();
				break;
				
			case "jslint-dummy":
				break;
		}
	}
};
