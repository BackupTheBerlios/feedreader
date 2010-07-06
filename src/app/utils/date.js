/*
 *		app/models/date.js
 */

var dateConverter = Class.create({

	convertRFC822: function(dateString) {
		var d = new Date(dateString);
		return d.getTime();
	},
	
	convertRFC2822: function(dateString) {
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

	convertDCDate: function(dateString) {
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
	
	convertSimpleDate: function(dateString) {
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

	/**
	 * Convert a date string to an integer; supports dc:date and RFC 822 format.
	 * 
	 * @param {String}		date string to reformat
	 */
	dateToInt: function(dateString) {
		var intDate;
		
		try {
			dateString = Formatting.stripCDATA(dateString);
			if(!dateString) {
				var d = new Date();
				intDate = d.getTime();
			} else if(dateString.match(/\D{3},\s\d{1,2}\s\D{3}\s\d{2,4}\s\d{1,2}:\d{1,2}:\d*/)) {
				intDate = this.convertRFC822(dateString);
			} else if(dateString.match(/\D{3}\s\D{3}\s\d{1,2}\s\d{2}:\d{2}(:\d{2}){0,1}\s[a-zA-Z\+\-0-9]{1,5}\s\d{3,4}/)) {
				intDate = this.convertRFC2822(dateString);
			} else if(dateString.match(/\d{1,2}\.\d{1,2}.\d{4}/)) {
				intDate = this.convertSimpleDate(dateString);
			} else {
				intDate = this.convertDCDate(dateString);
			}
		} catch(e) {
			
			Mojo.Log.error("Exception during date processing:", e);
			var d2 = new Date();
			intDate = d2.getTime();
			
		}
		return intDate;
	},
	
	dateToLocalTime: function(date) {
		if(date > 0) {		
			var d = new Date();
			d.setTime(date);
			return Mojo.Format.formatDate(d, "medium");
		} else {
			return $L("No date provided");
		}
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
	}
});