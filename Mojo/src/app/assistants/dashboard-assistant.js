/*
 *		app/assistants/dashboard-assistant.js
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

function DashboardAssistant(count) {
    this.count = count;
	this.inUpdate = false;
    this.launchAppHandler = this.launchApp.bindAsEventListener(this);
}

DashboardAssistant.prototype.setup = function() {
    this.updateDashboard(this.count);
    this.controller.listen("dashboardinfo", Mojo.Event.tap, this.launchAppHandler);
};

DashboardAssistant.prototype.cleanup = function() {
    this.controller.stopListening("dashboardinfo", Mojo.Event.tap, this.launchAppHandler);
};

DashboardAssistant.prototype.renderDashboard = function() {
	var info = {};
	var t = new Template($L("#{num} new stories"));

	if(!this.inUpdate) {
		info = {
			message: t.evaluate({ num: this.count }),
			count: this.count
		};
	} else {
		info = {
			message: $L("Updating feeds..."),
			count: ""
		};
	}
	
    var infoElement = this.controller.get("dashboardinfo").update(Mojo.View.render({
		object: info,
		template: "dashboard/dashboard-item"
	}));
	
	if(this.count > 0) {
		if(FeedReader.prefs.blinkingEnabled) {
			Mojo.Log.info("DASHBOARD> making the core navi button blink");
			this.controller.stageController.indicateNewContent(true);
		}
	} else if(!this.inUpdate) {
		this.closeDashboard();
	}
};

DashboardAssistant.prototype.launchApp = function() {
    Mojo.Controller.getAppController().assistant.handleLaunch({ action: "bannerPressed" });
    this.closeDashboard();
};

DashboardAssistant.prototype.updateDashboard = function(count) {
	if(count == -1) {
		this.inUpdate = true;
	} else if(count == -2) {
		this.inUpdate = false;
	} else {
		this.count = count;
	}
	
    this.renderDashboard();
};

DashboardAssistant.prototype.closeDashboard = function() {
	this.controller.window.close();
};
