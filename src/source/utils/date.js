/*
 *		source/utils/date.js - Date formatting functions
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

enyo.kind({

	name:		"DateFormatter",
	kind:		"Component",
	
	dateFormatter:		null,
	timeFormatter:		null,
	datetimeFormatter:	null,

	_convertRFC822: function(dateString) {
		var d = new Date(dateString);
		return d.getTime();
	},
	
	_convertRFC2822: function(dateString) {
		// Wed Mar 31 12:00 EDT 2010
		var d = new Date();
		var parts = dateString.split(" ");
		
		switch(parts[1]) {
			case "Jan":	d.setMonth(0); break;
			case "Feb": d.setMonth(1); break;
			case "Mar": d.setMonth(2); break;
			case "Apr": d.setMonth(3); break;
			case "May": d.setMonth(4); break;
			case "Jun": d.setMonth(5); break;
			case "Jul": d.setMonth(6); break;
			case "Aug": d.setMonth(7); break;
			case "Sep": d.setMonth(8); break;
			case "Oct": d.setMonth(9); break;
			case "Nov": d.setMonth(10); break;
			case "Dec": d.setMonth(11); break;
		}
		d.setDate(parseInt(parts[2], 10));
		d.setYear(parseInt(parts[5], 10));
		
		parts = parts[3].split(":");
		if(parts[0]) {
			d.setHours(parts[0]);
		}
		if(parts[1]) {
			d.setMinutes(parts[1]);
		}
		if(parts[2]) {
			d.setSeconds(parts[2]);
		} else {
			d.setSeconds(0);
		}
		
		return d.getTime();
	},

	_convertDCDate: function(dateString) {
		var d = new Date();
		
		// Dublin core date. See: http://www.w3.org/TR/NOTE-datetime
		var parts = dateString.split("T");
		if(parts[0]) {
			var dateComponents = parts[0].split("-");
			if(dateComponents[0]) {
				d.setFullYear(parseInt(dateComponents[0], 10));
			}
			if(dateComponents[1]) {
				d.setMonth(parseInt(dateComponents[1], 10) - 1);
			}
			if(dateComponents[2]) {
				d.setDate(parseInt(dateComponents[2], 10));
			}
		}
		if(parts[1]) {
			if (parts[1].match(/.*\-.*/)) {
				parts = parts[1].split('-');
			} else if (parts[1].match(/.*\+.*/)) {
				parts = parts[1].split('+');
			} else if (parts[1].match(/.*\D{1}/)) {
				parts[0] = parts[1].substring(0, parts[1].length - 2);
				parts[1] = parts[1].substring(parts[1].length - 1, 1);
			}
			if(parts[0]) {
				var timeComponents = parts[0].split(":");
				if(timeComponents[0]) {
					d.setHours(parseInt(timeComponents[0], 10));
				}
				if(timeComponents[1]) {
					d.setMinutes(parseInt(timeComponents[1], 10));
				}
				if(timeComponents[2]) {
					d.setSeconds(parseInt(timeComponents[2], 10));
				}
			}
			// TODO: respect the time zone.
		}
		return d.getTime();
	},
	
	_convertSimpleDate: function(dateString) {
		var d = new Date();
		var parts = dateString.split('.');
		if(parts[0]) {
			d.setDate(parseInt(parts[0], 10));
		}
		if(parts[1]) {
			d.setMonth(parseInt(parts[1], 10) - 1);
		}
		if(parts[2]) {
			d.setFullYear(parseInt(parts[2], 10));
		}
		
		d.setHours(0);
		d.setMinutes(0);
		d.setSeconds(0);
		
		return d.getTime();
	},
	
	_convertDiggDate: function(dateString) {
		// example: Thu, 04 November 2010 09:25:28
		var d = new Date();
		var parts = dateString.split(" ");
		
		switch(parts[2]) {
			case "January":		d.setMonth(0); break;
			case "February": 	d.setMonth(1); break;
			case "March": 		d.setMonth(2); break;
			case "April": 		d.setMonth(3); break;
			case "May": 		d.setMonth(4); break;
			case "June": 		d.setMonth(5); break;
			case "July": 		d.setMonth(6); break;
			case "August": 		d.setMonth(7); break;
			case "September": 	d.setMonth(8); break;
			case "October": 	d.setMonth(9); break;
			case "November": 	d.setMonth(10); break;
			case "December": 	d.setMonth(11); break;
		}
		d.setDate(parseInt(parts[1], 10));
		d.setYear(parseInt(parts[3], 10));
		
		parts = parts[4].split(":");
		if(parts[0]) {
			d.setHours(parts[0]);
		}
		if(parts[1]) {
			d.setMinutes(parts[1]);
		}
		if(parts[2]) {
			d.setSeconds(parts[2]);
		} else {
			d.setSeconds(0);
		}
		
		return d.getTime();
	},
	
	_convertSimpleDate2: function(dateString) {
		// example: 26 Nov 2010 02:30:00 +0100
		var d = new Date();
		var parts = dateString.split(" ");
		
		switch(parts[1]) {
			case "Jan":		d.setMonth(0); break;
			case "Feb": 	d.setMonth(1); break;
			case "Mar":		d.setMonth(2); break;
			case "Apr":		d.setMonth(3); break;
			case "May":		d.setMonth(4); break;
			case "Jun":		d.setMonth(5); break;
			case "Jul":		d.setMonth(6); break;
			case "Aug":		d.setMonth(7); break;
			case "Sep": 	d.setMonth(8); break;
			case "Oct": 	d.setMonth(9); break;
			case "Nov": 	d.setMonth(10); break;
			case "Dec": 	d.setMonth(11); break;
		}
		d.setDate(parseInt(parts[0], 10));
		d.setYear(parseInt(parts[2], 10));
		
		parts = parts[3].split(":");
		if(parts[0]) {
			d.setHours(parts[0]);
		}
		if(parts[1]) {
			d.setMinutes(parts[1]);
		}
		if(parts[2]) {
			d.setSeconds(parts[2]);
		} else {
			d.setSeconds(0);
		}
		
		return d.getTime();
	},

	/**
	 * Convert a date string to an integer; supports dc:date and RFC 822 format.
	 * 
	 * @param {String}		date string to reformat
	 */
	dateToInt: function(dateString, storyFormatter) {
		var intDate;
		
		dateString = storyFormatter.stripBreaks(dateString);
		
		try {
			dateString = storyFormatter.stripCDATA(dateString);
			if(!dateString) {
				var d = new Date();
				intDate = d.getTime();
			} else if(dateString.match(/\D{3},\s\d{1,2}\s\D{3}\s\d{2,4}\s\d{1,2}:\d{1,2}:\d*/)) {
//				this.log("DATE> RFC822", dateString);
				intDate = this._convertRFC822(dateString);
			} else if(dateString.match(/\D{3}\s\D{3}\s\d{1,2}\s\d{2}:\d{2}(:\d{2}){0,1}\s[a-zA-Z\+\-0-9]{1,5}\s\d{3,4}/)) {
//				this.log("DATE> RFC2822", dateString);
				intDate = this._convertRFC2822(dateString);
			} else if(dateString.match(/\d{1,2}\.\d{1,2}.\d{4}/)) {
//				this.log("DATE> SIMPLEDATE", dateString);
				intDate = this._convertSimpleDate(dateString);
			} else if(dateString.match(/[a-zA-z]{3}\,\s\d{2}\s[a-zA-Z]+\s\d{4}\s\d{2}\:\d{2}:\d{2}/)) {
//				this.log("DATE> DIGGDATE", dateString);
				intDate = this._convertDiggDate(dateString);
			} else if(dateString.match(/\d{2}\s\D{3}\s\d{4}\s\d{2}:\d{2}:\d{2}.*/)) {
//				this.log("DATE> SIMPLEDATE2", dateString);
				intDate = this._convertSimpleDate2(dateString);
			} else {
//				this.log("DATE> DCDATE", dateString);
				intDate = this._convertDCDate(dateString);
			}
		} catch(e) {
			
			this.error("DATE EXCEPTION>", e);
			var d2 = new Date();
			intDate = d2.getTime();
			
		}
		return intDate;
	},
	
	formatDate: function(date) {
		if(date > 0) {		
			var d = new Date();
			d.setTime(date);
			return this.dateFormatter.format(d);
		} else {
			return $L("No date provided");
		}
	},
	
	formatTime: function(date) {
		if(date > 0) {		
			var d = new Date();
			d.setTime(date);
			return this.timeFormatter.format(d);
		} else {
			return $L("No time provided");
		}
	},
	
	formatDateTime: function(date) {
		if(date > 0) {		
			var d = new Date();
			d.setTime(date);
			return this.datetimeFormatter.format(d);
		} else {
			return $L("No time provided");
		}
	},
	
	datesEqual: function(d1, d2) {
		if((d1 <= 0) && (d2 <= 0)) {
			return true;
		}
		var date1 = new Date(d1);
		var date2 = new Date(d2);
		
		return (date1.getFullYear() == date2.getFullYear()) &&
			   (date1.getMonth() == date2.getMonth()) &&
			   (date1.getDate() == date2.getDate());
	},
	
	formatTimeString: function(secs) {
        if(secs > 0) {
			var mins = Math.floor(secs / 60);
			secs = Math.floor(secs % 60);
			
			// Pad with zeros if needed.
			// ToDo: Replace this, once a proper sprintf() replacement is found.
			if (mins < 10) {
				mins = "0" + mins;
			}
			if (secs < 10) {
				secs = "0" + secs;
			}
			return mins + ":" + secs;
		}
		return "00:00";
	},
	
	create: function() {
		this.inherited(arguments);
		this.dateFormatter = new enyo.g11n.DateFmt({
			date:	"medium",
			time:	""
		});
		this.timeFormatter = new enyo.g11n.DateFmt({
			date:	"",
			time:	"medium"
		});
		this.datetimeFormatter = new enyo.g11n.DateFmt({
			format:	"medium"
		});		
	}
});