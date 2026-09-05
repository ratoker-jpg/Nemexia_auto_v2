function Vacation(premiumPopup) {
	var _this = this;
	var _subDisplayContainer = $('.premiumSubDisplay.vacation');
	var _timeLeft = _subDisplayContainer.find('#vacation_TimerHolder .countdown').attr('data-time-remaining');

	_subDisplayContainer.find('#vacation_activateButton').click(function() {
		var btnClicked = $(this);

		if (btnClicked.hasClass('inactive') == true) {
			return;
		}

		showConfirm(premiumPopup.getTranslation('VACATION_ACTIVATE_CONFIRM'), function() {
			btnClicked.addClass('inactive');
			activateVacation();
		});

		return;
	});

	_subDisplayContainer.find('#vacation_autoCheckbox').click(function () {
		var btnClicked = $(this);

		showConfirm(premiumPopup.getTranslation('VACATION_AUTO_ACTIVATE_CONFIRM'), function () {
			btnClicked.attr('disabled', 'disabled');

			premiumPopup.applyMethod('subtabVacationMode', 'setAuto', {
				auto: btnClicked.prop('checked') ? 1 : 0
			}, function () {
				btnClicked.removeAttr('disabled');
			});
		}, function () {
			btnClicked.prop('checked', !btnClicked.prop('checked'));
		});

		return;
	});

	_subDisplayContainer.find('#vacation_TimerHolder').bind('mouseover', function(){
		Tip($(this).find('.countdown').attr('data-time-expireDate'));
	}).bind('mouseout', function(){
		UnTip();
	});
	
	// Extend buttons
	_subDisplayContainer.find('#vacation_PlatinumVacationBtn').click(function() {
		premiumPopup.hide();
		openPlatinumPopup('tabVacation');
	});

	this.timerTick = function() {
		if (isNaN(_timeLeft) || _timeLeft == undefined) {
			return false;
		}

		if (_timeLeft <= 0) {
			_subDisplayContainer.find('#vacation_TimerHolder').slideUp('slow');
			_subDisplayContainer.find('#vacation_activateButton').removeClass('inactive');
			return true;
		}

		_subDisplayContainer.find('#vacation_TimerHolder .countdown').html(SecToTime(_timeLeft));

		_timeLeft--;
		setTimeout(_this.timerTick, 1000);

		return true;
	};

	this.timerTick();
}

if (window.dependencyResolver) {
	window.dependencyResolver.markAsLoaded('Vacation');
}