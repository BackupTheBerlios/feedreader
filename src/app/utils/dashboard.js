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

var DashboardControl = {
	/**
	 *
	 * WebOS 1.4+ doesn't allow headless apps to run longer than 15/60 seconds
	 * without an open stage. Therefore we use the dashboard stage to indicate
	 * a scheduled update.
	 *
	 * Open the update dashboard.
	 * 
	 */
	createUpdateDashboard: function(force) {
		var appController = Mojo.Controller.getAppController();
		var mainStageController = appController.getStageProxy(FeedReader.mainStageName);
		var dashboardStageController = appController.getStageProxy(FeedReader.dashboardStageName);
		
		if(mainStageController && (force === undefined)) {
			return;
		}
		
		if(!dashboardStageController) {
			appController.createStageWithCallback({
				name: 			FeedReader.dashboardStageName,
				lightweight: 	true
			}, function(stageController) {
				stageController.pushScene("dashboard", -1);
			}, "dashboard");
		} else {
			dashboardStageController.delegateToSceneAssistant("updateDashboard", -1);
		}
	},
	
	/**
	 *
	 * WebOS 1.4+ doesn't allow headless apps to run longer than 15/60 seconds
	 * without an open stage. Therefore we use the dashboard stage to indicate
	 * a scheduled update.
	 *
	 * Close the update dashboard.
	 *
	 */
	removeUpdateDashboard: function() {
		var appController = Mojo.Controller.getAppController();
		var dashboardStageController = appController.getStageProxy(FeedReader.dashboardStageName);
		
		if(dashboardStageController) {
			dashboardStageController.delegateToSceneAssistant("updateDashboard", -2);
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
		
		// Check if the main stage exists.
		var appController = Mojo.Controller.getAppController();
		if(!FeedReader.prefs.notifyWhileRunning) {
			if(appController.getStageProxy(FeedReader.mainStageName)) {
				Mojo.Log.info("FEEDREADER> Ignoring notification as app is running");
				return;
			}
			
		}
		
		// Now create/update the dashboard.
		var dashboardStageController = appController.getStageProxy(FeedReader.dashboardStageName);
		if(!dashboardStageController) {
			appController.createStageWithCallback({
				name: 			FeedReader.dashboardStageName,
				lightweight:	true
			}, function(stageController) {
				stageController.pushScene("dashboard", count);			
			}, "dashboard");
		} else {
			dashboardStageController.delegateToSceneAssistant("updateDashboard", count);
		}
	}
};
