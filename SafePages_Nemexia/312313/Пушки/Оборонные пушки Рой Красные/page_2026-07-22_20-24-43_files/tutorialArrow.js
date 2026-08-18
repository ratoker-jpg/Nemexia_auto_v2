var TutorialArrowBlinkInterval = 2000;
var TutorialArrowBlinkEnabled = false;
var tutorialArrow;

$(document).ready(function() {
	tutorialArrow = new TutorialArrow();
	tutorialArrow.init();
	tutorialArrow.show();
});

$(document).on('headerHudToggleFinished', function() {
	tutorialArrow.positionArrow();
});

function TutorialArrowBlink() {
	if (TutorialArrowBlinkEnabled == false) {
		$('#TutorialArrow').hide();
		return;
	}

	$('#TutorialArrow').fadeOut('slow',
		function() {
			$('#TutorialArrow').fadeIn('slow');
		});

	window.setTimeout("TutorialArrowBlink()", TutorialArrowBlinkInterval);
}

function TutorialArrow() {
	this.config = undefined;
	this.arrowIndentifier = undefined;
	this.arrowSelector = '#TutorialArrow';

	this.init = function(config, arrowIndentifier) {
		this.config = config;
		this.arrowIndentifier = arrowIndentifier;
		this.loadConfig();

		if (this.config.isEnabled == false) {
			return true;
		}

		this.addArrowToPage();
		this.positionArrow();
	}

	this.show = function(ignoreScroll) {
		if (this.config.isEnabled == false) {
			return true;
		}

		var arrow = $(this.arrowSelector);
		arrow.show();
		TutorialArrowBlinkEnabled = true;
		TutorialArrowBlink();

		if (ignoreScroll == undefined || ignoreScroll == false) {
			$(document).scrollTop(arrow.offset().top - 100);
		}
	}

	this.hide = function(arrowIndentifier) {
		if (arrowIndentifier !== undefined && arrowIndentifier != this.arrowIndentifier) {
			return;
		}
		
		var arrow = $(this.arrowSelector);
		TutorialArrowBlinkEnabled = false;
		arrow.hide();
	}

	this.loadConfig = function() {
		if (this.config == undefined) {
			var jsonConfig = decodeURIComponent(this.getUrlParam('TutorialArrow'));
			if (jsonConfig !== "") {
				this.config = eval('(' + jsonConfig + ')');
			}
		}

		if (this.config == undefined) {
			this.config = {
				isEnabled: false
			};
			return;
		}

		this.config.isEnabled = true;

		if (this.config.left == undefined) {
			this.config.left = 0;
		}
		if (this.config.top == undefined) {
			this.config.top = 0;
		}
		if (this.config.position == undefined) {
			this.config.position = 'top';
		}
		if (this.config.elemSelector == undefined) {
			this.config.elemSelector = 0;
		}
		if (this.config.elemX == undefined) {
			this.config.elemX = 0;
		}
		if (this.config.elemY == undefined) {
			this.config.elemY = 0;
		}
		if (this.config.tooltip == undefined) {
			this.config.tooltip = 0;
		}
		
		if (this.config.elemSelector !== 0 && $(this.config.elemSelector).length != 1) {
			this.config = {
				isEnabled: false
			};
			return;
		}
	}

	this.addArrowToPage = function() {
		if ($(this.arrowSelector).length > 0) {
			return;
		}

		$('body').prepend('<div id="TutorialArrow" class="' + this.config.position + '"></div>');

		var _this = this;
		var arrow = $(this.arrowSelector);

		arrow.bind('click', function(){
			_this.hide();
		});

		arrow.bind('mouseover', function() {
			Tip(_this.config.tooltip != 0 ? _this.config.tooltip:TutorialArrowClickHere);
		});

		arrow.bind('mouseout', function() {
			UnTip();
		});
	}

	this.positionArrow = function() {
		var arrow = $(this.arrowSelector);

		var posX = 0;
		var posY = 0;
		var arrowHeight = arrow.height();
		var arrowWidth = arrow.width();

		var elemHeight = 0;
		var elemWidth = 0;

		if (this.config.top != 0 || this.config.left != 0) {
			posX = this.config.left;
			posY = this.config.top;
		} else if (this.config.elemSelector != 0 && $(this.config.elemSelector).length > 0) {
			pageElement = $(this.config.elemSelector);
			var elemPosition = pageElement.offset();

			posX = elemPosition.left + this.config.elemX;
			posY = elemPosition.top + this.config.elemY;

			elemHeight = pageElement.height();
			elemWidth = pageElement.width();
		}

		if (this.config.position == 'top') {
			posY = posY - arrowHeight;
			posX = posX + ((elemWidth - arrowWidth)  / 2);
		}

		arrow.css('top', posY);
		arrow.css('left', posX);
	}

	this.getUrlParam = function(varname) {
		varname = varname.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
		var regexS = "[\\?&]"+varname+"=([^&#]*)";
		var regex = new RegExp(regexS);
		var results = regex.exec(window.location.href);
		if (results == null) return ""; else return results[1];
	}
}