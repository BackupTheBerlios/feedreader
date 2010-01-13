/**
 * Global object that contains various global variables and some
 * utility functions. It also contains the main model (feeds).
 */
FeedReader = {
	appName:			"FeedReader",
	appAuthor:			"Timo Tegtmeier",
	versionString:		"1.0",
	copyrightYears:		"2009, 2010",

	mainStageName: 		"FeedReaderStage",
	
	isActive: 			false,
	
	menuAttr: {},
	menuModel: {
    	visible: true,
    	items: [ 
        	{label: $L("About FeedReader"), command: "do-about"},
        	{label: $L("Update all Feeds"), checkEnabled: true, command: "do-feedUpdate"}
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
}

/**
 * Setup function for the AppAssistant.
 */
AppAssistant.prototype.setup = function() {
	FeedReader.prefs = new prefs();
	FeedReader.prefs.load();
	
	FeedReader.feeds = new feeds();
	FeedReader.feeds.load();
		          
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
					var t = new Template("#{appName} — v#{version}");
					var m = new Template("Copyright #{years} #{author}");
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
