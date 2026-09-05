function NicknameChange(premiumPopup) {
	var _this = this;
	var _subDisplayContainer = $('.premiumSubDisplay.nicknameChange');
	var _timeLeft = _subDisplayContainer.find('#nicknameChange_TimerHolder .countdown').attr('data-time-remaining');

	_subDisplayContainer.find('#nicknameChange_creditsButton').click(function() {
		var btnClicked = $(this);

		if (btnClicked.hasClass('inactive') == true) {
			return;
		}

		showConfirm(premiumPopup.getTranslation('CHANGE_NICK_CONFIRM'), function() {
			btnClicked.addClass('inactive');
			premiumPopup.applyMethod(
				'subtabChangeNickname', 'changeNickname', {
					newNickname: _subDisplayContainer.find('#nicknameChange_nicknameInput').val(),
					displayMethod: 1
				});
		});

		return;
	});

	_subDisplayContainer.find('#nicknameChange_TimerHolder').bind('mouseover', function(){
		Tip($(this).find('.countdown').attr('data-time-expireDate'));
	}).bind('mouseout', function(){
		UnTip();
	});

	this.timerTick = function() {
		if (isNaN(_timeLeft) || _timeLeft == undefined) {
			return false;
		}

		if (_timeLeft <= 0) {
			_subDisplayContainer.find('#nicknameChange_TimerHolder').slideUp('slow');
			_subDisplayContainer.find('#nicknameChange_creditsButton').removeClass('inactive');
			return true;
		}

		_subDisplayContainer.find('#nicknameChange_TimerHolder .countdown').html(SecToTime(_timeLeft));

		_timeLeft--;
		setTimeout(_this.timerTick, 1000);

		return true;
	}

	this.timerTick();
}

if (window.dependencyResolver) {
	window.dependencyResolver.markAsLoaded('NicknameChange');
}
