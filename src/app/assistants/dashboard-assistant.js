/*
 *		app/assistants/dashboard-assistant.js
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

function DashboardAssistant(count) {
    this.count = count;
    this.launchAppHandler = this.launchApp.bindAsEventListener(this);
}

DashboardAssistant.prototype.setup = function() {
    this.renderDashboard();
    this.controller.listen("dashboardinfo", Mojo.Event.tap, this.launchAppHandler);
};

DashboardAssistant.prototype.cleanup = function() {
    this.controller.stopListening("dashboardinfo", Mojo.Event.tap, this.launchAppHandler);
};

DashboardAssistant.prototype.renderDashboard = function() {
	var t = new Template($L("#{num} new stories"));

    var info = {
		message: t.evaluate({ num: this.count }),
		count: this.count
	};
	
    var infoElement = this.controller.get("dashboardinfo").update(Mojo.View.render({
		object: info,
		template: "dashboard/dashboard-item"
	}));
	
	this.controller.stageController.indicateNewContent(true);
};

DashboardAssistant.prototype.launchApp = function() {
    Mojo.Controller.getAppController().assistant.handleLaunch({ action: "bannerPressed" });
    this.controller.window.close();
};

DashboardAssistant.prototype.updateDashboard = function(count) {
    this.count = count;
    this.renderDashboard();
};
