/*
 *		app/utils/dashboard.js
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

var SceneControl = {
	menuAttr: 			{},
	menuModel: 			{
    	visible: true,
    	items: [ 
        	{ label: $L("About FeedReader"), command: "do-about" },
			{ label: $L("Import feeds"), command: "do-import" },
			{ label: $L("License"), command: "do-license" }
    	]
	},
	
	/**
	 * Called to indicate that a scene is beginning its setup.
	 * This will initialize the App Menu if desired.
	 * 
	 * @param {Object}		Scene assistant
	 * @parsm {Boolean}		Whether the app menu shall be initialized
	 */
	beginSceneSetup: function(caller, initAppMenu) {
		if(caller.setupFinished !== undefined) {
			delete caller.setupFinished;
		}
		
		if(initAppMenu) {
			// Setup application menu.
			caller.controller.setupWidget(Mojo.Menu.appMenu, this.menuAttr, this.menuModel);
		}
		caller.setupComplete = false;
		caller.aboutToActivate = this.aboutToActivate.bind(caller);
		
		Mojo.Log.info("SC> Creating scrim");
		caller.scrim = document.createElement('div');
		caller.scrim.addClassName("palm-scrim");
		caller.controller.topContainer().appendChild(caller.scrim);
		
		caller.scrim.innerHTML = Mojo.View.render({
			object:	{
				loading: $L('Loading data')
			},
			template: 'common/scrim'
		});
		caller.controller.setupWidget("scrimSpinner", {
			spinnerSize: "large"
        }, {
			spinning: true 
        }); 		
	},
	
	/**
	 * Called to indicate that a scene has finished its setup.
	 * 
	 * @param {Object}		Scene assistant
	 */
	endSceneSetup: function(caller) {
		if(!caller.setupComplete) {
			caller.setupComplete = true;
			if(caller.scrim) {
				if(caller.setupFinished !== undefined) {
					caller.scrim.hide.bind(caller.scrim).delay(0.5);
				} else {
					caller.scrim.hide();					
				}
			}
			if(caller.setupFinished !== undefined) {
				Mojo.Log.info("SC> setup finished; enabling transition");
				caller.setupFinished();
			}
		}
	},
	
	/**
	 * Called to indicate that a scene is about to activate.
	 * 
	 * @param {Function}	callback provided by webOS
	 */
	aboutToActivate: function(callback) {
		try {
			if(this.setupComplete) {
				Mojo.Log.info("SC> setup already completed; enabling transition");
				this.scrim.hide();
				callback();
			} else {
				this.setupFinished = callback;
			}
		} catch(e) {
			Mojo.Log.error("SC> Error: %s, line %s", e.message, e.line);
		}
	},
	
	/**
	 * Remove the application splash screen.
	 */	
	hideSplash: function() {
		var cardStageController = Mojo.Controller.getAppController().getStageController(FeedReader.mainStageName);
		if(cardStageController) {
			cardStageController.hideSplashScreen();
		}
	}
};