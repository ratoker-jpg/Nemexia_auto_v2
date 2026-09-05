function ChangePlanetCoords(premiumPopup) {
	var _subDisplayContainer;
	var _cooldownTimeDisplay;
	var _timeLeft;

	function _timerTick() {
		_timeLeft--;
		if (_timeLeft < 0) {
			_subDisplayContainer.find('#planetChangeCoords_TimerHolder').slideUp('slow');
			_subDisplayContainer.find('#planetChangeCoords_creditsButton').removeClass('inactive');
			return true;
		}

		_subDisplayContainer.find('#planetChangeCoords_TimerHolder .countdown').html(SecToTime(_timeLeft));

		setTimeout(_timerTick, 1000);

		return true;
	}

	function _init() {
		_subDisplayContainer = $('.premiumSubDisplay.planetChangeCoords');
		_cooldownTimeDisplay = _subDisplayContainer.find('#planetChangeCoords_TimerHolder .countdown');

		_subDisplayContainer.find('#planetChangeCoords_submitChangeBtn').click(function() {
			var btnClicked = $(this);
			
			if (btnClicked.hasClass('inactive')) {
				return;
			}
			
			showConfirm(premiumPopup.getTranslation('CHANGE_COORDS_CONFIRM'), function() {
				btnClicked.addClass('inactive');
				premiumPopup.applyMethod(
					'subtabRelocatePlanet',
					'changePlanetCoords',
					{
						c1: _subDisplayContainer.find('#planetChangeCoords_c1').val(),
						c2: _subDisplayContainer.find('#planetChangeCoords_c2').val(),
						c3: _subDisplayContainer.find('#planetChangeCoords_c3').val()
					},
					{
						onfail: function() {
							btnClicked.removeClass('inactive');
						}
					});
			});
		});

		_subDisplayContainer.find('#planetChangeCoords_TimerHolder').bind('mouseover', function(){
			Tip(_cooldownTimeDisplay.attr('data-time-expireDate'));
		}).bind('mouseout', function(){
			UnTip();
		});

		_timeLeft = _cooldownTimeDisplay.attr('data-time-remaining');
		if (!isNaN(_timeLeft) && _timeLeft != undefined) {
			_cooldownTimeDisplay.html(SecToTime(_timeLeft));
			setTimeout(_timerTick, 1000);
		}

		return;
	}

	_init();
}

if (window.dependencyResolver) {
	window.dependencyResolver.markAsLoaded('ChangePlanetCoords');
}
