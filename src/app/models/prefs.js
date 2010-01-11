var prefs = Class.create({
	updateInterval:	15,
	notificationEnabled: true,
	wakingEnabled: false,
	
	timer: {},
	
	initialize: function() {
		this.cookie = new Mojo.Model.Cookie("comtegi-stuffAppFeedReaderPrefs");
		this.setTimerSuccessHandler = this.setTimerSuccess.bind(this);
		this.setTimerFailedHandler  = this.setTimerFailed.bind(this);
	},
	
	load: function() {
		var settings = this.cookie.get();
		if(settings) {
			this.updateInterval = settings.updateInterval;
			this.notificationEnabled = settings.notificationEnabled;
			this.wakingEnabled = settings.wakingEnabled;
		}
	},
	
	save: function() {
		this.cookie.put({
			version: 0,
			updateInterval: this.updateInterval,
			notificationEnabled: this.notificationEnabled,
			wakingEnabled: this.wakingEnabled
		});
		this.setTimer();
	},
	
	setTimerSuccess: function(response) {
		Mojo.Log.info("Timer successfully set");
	},
	
	setTimerFailed: function(reponse) {
		Mojo.Log.warn("Unable to set timer:", response);
	},
	
	setTimer: function() {
        if (this.updateInterval > 0) {
			var hours, minutes, seconds;
			if (this.updateInterval >= 1440) {
				hours   = 23;
				minutes = 59;
				seconds = 59;
			} else {
				hours   = parseInt(this.updateInterval / 60, 10);
				minutes = this.updateInterval % 60;
				seconds = 0;
			}
			var t = new Template("#{h}:#{m}:#{s}");
			
            this.timer = new Mojo.Service.Request("palm://com.palm.power/timeout", {
                method: "set",
                parameters: {
                    "key": "com.tegi-stuff.feedreader.timer",
                    "in": t.evaluate({
						h: hours,
						m: minutes,
						s: seconds
					}),
                    "wakeup": this.wakingEnabled,
                    "uri": "palm://com.palm.applicationManager/open",
                    "params": {
                        "id": "com.tegi-stuff.app.feedreader",
                        "params": {
							"action": "feedUpdate"
						}
                    }
                },
                onSuccess: this.setTimerSuccessHandler,
                onFailure: this.setTimerFailedHandler
            });
        } else {
			this.timer = new Mojo.Service.Request("palm://com.palm.power/timeout", {
				method: "clear",
				parameters: {
					"key": "com.tegi-stuff.feedreader.timer"
				},
				onSuccess: this.setTimerSuccessHandler,
                onFailure: this.setTimerFailedHandler
			});
		}	
	}
});
