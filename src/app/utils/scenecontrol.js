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

var ScrimController = Class.create({
	initialize: function(scene) {
		this.scene = scene;
		this.scrimDiv = scene.controller.get('load-scrim');
		this.spinner = scene.controller.get('load-spinner');
		
		this.shown = true;
		this.spinnerAttribs = {	spinnerSize: "large" };
		this.spinnerModel = { spinning: true };
		this.hide = this.hide.bind(this);
		
		if(this.spinner) {
			Mojo.Log.info("SC> Setting up loading spinner");
			scene.controller.setupWidget("load-spinner", this.spinnerAttribs, this.spinnerModel);
		}
	},
	
	/** @private
	 */
	showSiblings: function(elem) {
		var siblings = elem.siblings();
		for(var i = 0; i < siblings.length; i++) {
			siblings[i].show();
		}
	},
	
	show: function() {
		if(!this.shown) {
			if(this.scrimDiv) {
				this.scrimDiv.show();
			}
			if(this.spinner) {
				this.spinnerModel.spinning = true;
				this.scene.controller.modelChanged(this.spinnerModel);
			}
		}
		this.shown = true;
	},
	
	hide: function() {
		if(this.shown) {
			if(this.spinner) {
				this.spinnerModel.spinning = false;
				this.scene.controller.modelChanged(this.spinnerModel);
			}
			if(this.scrimDiv) {
				if(this.scrimDiv) {
					this.showSiblings(this.scrimDiv);
				}
				this.scrimDiv.hide();
			}
		}
		this.shown = false;
	},
	
	hideWithDelay: function() {
		this.hide.delay(0.5);
	}
	
});

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
		if(caller.setupFinished !== null) {
			caller.setupFinished = null;
		}
		
		caller.setupComplete = false;
		caller.aboutToActivate = this.aboutToActivate.bind(caller);
		caller.scrimController = new ScrimController(caller);
		
		if(initAppMenu) {
			// Setup application menu.
			caller.controller.setupWidget(Mojo.Menu.appMenu, this.menuAttr, this.menuModel);
		}
	},
	
	/**
	 * Called to indicate that a scene has finished its setup.
	 * 
	 * @param {Object}		Scene assistant
	 */
	endSceneSetup: function(caller) {
		if(!caller.setupComplete) {
			caller.setupComplete = true;
			if(caller.scrimController) {
				caller.scrimController.hideWithDelay();
			}
			if(caller.setupFinished) {
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
				if(this.scrimController) {
					this.scrimController.hide();
				}
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