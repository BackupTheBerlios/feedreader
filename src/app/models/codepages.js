/*
 *		app/models/codepages.js
 */

var codepageConverter = Class.create({
	/** @private
	 *
	 * !! HACK WARNING !!
	 * This should not be needed theoretically. But prototype or maybe even
	 * WebOS gets the encoding wrong as it displays the corresponding
	 * characters from windows-1252. This thingy does the conversion.
	 * 
	 * Coverts text from codepage 1250.
	 */
	convertWin1250: function(text) {
		if(text) {
			text = text.replace(/Œ/g, "Ś");	// 8C
			
			text = text.replace(/œ/g, "ś");	// 9C
			text = text.replace(/Ÿ/g, "ź");	// 9F
			
			text = text.replace(/¢/g, "˘");	// A2
			text = text.replace(/£/g, "Ł"); // A3
			text = text.replace(/¥/g, "Ą");	// A5
			text = text.replace(/ª/g, "Ş");	// AA
			
			text = text.replace(/³/g, "ł");	// B3
			text = text.replace(/¹/g, "ą");	// B9
			text = text.replace(/º/g, "ş");	// BA
			text = text.replace(/¼/g, "Ľ");	// BC
			text = text.replace(/½/g, "˝"); // BD
			text = text.replace(/¾/g, "ľ");	// BE
			text = text.replace(/¿/g, "ż");	// BF
			
			text = text.replace(/À/g, "Ŕ");	// C0
			text = text.replace(/Ã/g, "Ă");	// C3
			text = text.replace(/Å/g, "Ĺ");	// C5
			text = text.replace(/Æ/g, "Ć");	// C6
			text = text.replace(/È/g, "Č");	// C8
			text = text.replace(/Ê/g, "Ę");	// CA
			text = text.replace(/Ì/g, "Ě");	// CC
			text = text.replace(/Ï/g, "Ď");	// CF
			
			text = text.replace(/Ñ/g, "Ń");	// D1
			text = text.replace(/Ò/g, "Ň");	// D2
			text = text.replace(/Õ/g, "Ő");	// D5
			text = text.replace(/Ø/g, "Ř");	// D8
			text = text.replace(/Ù/g, "Ů");	// D9
			text = text.replace(/Û/g, "Ű");	// DB
			text = text.replace(/Þ/g, "Ţ");	// DE
			
			text = text.replace(/à/g, "ŕ");	// E0
			text = text.replace(/ã/g, "ă");	// E3
			text = text.replace(/å/g, "ĺ");	// E5
			text = text.replace(/æ/g, "ć");	// E6
			text = text.replace(/è/g, "č");	// E8
			text = text.replace(/ê/g, "ę");	// EA
			text = text.replace(/ì/g, "ě");	// EC
			text = text.replace(/ï/g, "ď");	// EF
			
			text = text.replace(/ð/g, "đ");	// F0
			text = text.replace(/ñ/g, "ń");	// F1
			text = text.replace(/ò/g, "ň");	// F2
			text = text.replace(/õ/g, "ő");	// F5
			text = text.replace(/ø/g, "ř");	// F8
			text = text.replace(/ù/g, "ů");	// F9
			text = text.replace(/û/g, "ű");	// FB
			text = text.replace(/þ/g, "ţ");	// FE
			text = text.replace(/ÿ/g, "˙");	// FF
			
			return text;
		} else {
			return "";
		}
	},
	
	convert: function(contentType, text) {
		if(!contentType) {
			return text;
		}
		
		if(contentType.match(/.*windows\-1250.*/) ||
		   contentType.match(/.*win\-1250.*/)) {
			return this.convertWin1250(text);
		}
		
		return text;
	}
});