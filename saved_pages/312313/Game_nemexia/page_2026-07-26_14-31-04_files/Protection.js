function Protection(premiumPopup) {
	var _this = this;
	var _subDisplayContainer = $('.premiumSubDisplay.protection');
	var _timeLeft = _subDisplayContainer.find('#protection_TimerHolder .countdown').attr('data-time-remaining');

	_subDisplayContainer.find('#protection_creditsButton').click(function() {
		var btnClicked = $(this);

		if (btnClicked.hasClass('inactive') == true) {
			return;
		}

		showConfirm(premiumPopup.getTranslation('PROTECTION_ACTIVATE_CONFIRM'), function() {
			btnClicked.addClass('inactive');
			premiumPopup.applyMethod(
				'subtabProtection', 'activate', {
					displayMethod: 1
				});
		});

		return;
	});

	_subDisplayContainer.find('#protection_TimerHolder.daysLeft').bind('mouseover', function(){
		Tip($(this).find('.daysDisplay').attr('data-time-expireDate'));
	}).bind('mouseout', function(){
		UnTip();
	});

	_subDisplayContainer.find('#protection_TimerHolder.cooldown').bind('mouseover', function(){
		Tip($(this).find('.countdown').attr('data-time-expireDate'));
	}).bind('mouseout', function(){
		UnTip();
	});
	
	// Extend buttons
	_subDisplayContainer.find('#protection_PlatinumProtectionBtn').click(function() {
		premiumPopup.hide();
		openPlatinumPopup('tabProtection');
	});

	this.timerTick = function() {
		if (isNaN(_timeLeft) || _timeLeft == undefined) {
			return false;
		}

		if (_timeLeft <= 0) {
			_subDisplayContainer.find('#protection_TimerHolder').slideUp('slow');
			_subDisplayContainer.find('#protection_creditsButton').removeClass('inactive');
			return true;
		}

		_subDisplayContainer.find('#protection_TimerHolder .countdown').html(SecToTime(_timeLeft));

		_timeLeft--;
		setTimeout(_this.timerTick, 1000);

		return true;
	};
	
	this.timerTick();
}

if (window.dependencyResolver) {
	window.dependencyResolver.markAsLoaded('Protection');
}