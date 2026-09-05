function RankingTournamentRewardsPopup() {
	var _this = this;

	this._currentType = null;

	this.show = function (tournamentType) {
		this._currentType = null;

		$.post('ajax_misc.php?uid=' + (new Date()).valueOf(), {
			type: 'getTournamentRewardsPopup',
			tournamentType: tournamentType
		}, function (response) {
			if (response.status === false) {
				showDialogMessage(response.message);
				return;
			}

			_this._currentType = tournamentType;
			_this._renderPopup(response.content);
		}, 'json');

		return this;
	};

	this._renderPopup = function (content) {
		$('.black_overlay').show();
		$("#dialogBox").html(content);
		$("#dialogMessage")
				.addClass('rankingTournamentRewardsPopup')
				.addClass(this._currentType)
				.fadeIn('fast');

		$('#rankingTournamentRewardsPopup_closeButton, .black_overlay').bind('click', function () {
			_this._removePopup();
		});

		return this;
	};

	this._removePopup = function () {
		$('#dialogMessage').fadeOut('slow', function () {
			$('.black_overlay').hide();
			$("#dialogMessage")
					.removeClass('rankingTournamentRewardsPopup')
					.removeClass(_this._currentType);
			$('#rankingTournamentRewardsPopup_closeButton, .black_overlay').unbind('click');
		});

		return this;
	};
}

function RankingTournamentTimer(type) {
	var _this = this;

	this._type = type;
	this._loadDate = new Date();

	this._containerElem = $('.rankingWrapper .menu.tournamentsTypeSelection .' + type);
	this._timerDisplay = this._containerElem.find('.timer');

	this.onTimerCallbacks = [];

	this.init = function () {
		this.addOnTimerCallback(function () {
			_this.start();
		});

		this._timerDisplay.bind('mouseover', function () {
			var tipText = '';

			if (_this._containerElem.hasClass('pre_competition')) {
				tipText = _this._timerDisplay.attr('data-pre-comp-tip');
			} else if (_this._containerElem.hasClass('competition')) {
				tipText = _this._timerDisplay.attr('data-comp-tip');
			} else {
				return;
			}

			Tip(tipText);
		}).bind('mouseout', function () {
			UnTip();
		});

		return this;
	};

	this.start = function () {
		var stageInfo = this.getStageInfo();

		if (stageInfo.stage === 'not_active') {
			this._containerElem.hide(300);
			return this;
		}

		this._containerElem
				.removeClass('pre_competition competition post_competition not_active')
				.addClass(stageInfo.stage);

		this._setTimer(stageInfo.nextStageIn);

		return this;
	};

	this.addOnTimerCallback = function (callback) {
		this.onTimerCallbacks.unshift(callback);
		return this;
	};

	this.getType = function () {
		return this._type;
	};

	this.getStageInfo = function () {
		var stage = false;
		var nextStageIn = 0;

		var elapsedSinceLoad = Math.round((new Date().getTime() - this._loadDate.getTime()) / 1000);
		var elapsed = parseInt(this._timerDisplay.attr('data-elapsed')) + elapsedSinceLoad;

		var preComp = parseInt(this._timerDisplay.attr('data-pre-comp'));
		var comp = parseInt(this._timerDisplay.attr('data-comp'));
		var postComp = parseInt(this._timerDisplay.attr('data-post-comp'));

		if (elapsed < preComp) {
			stage = 'pre_competition';
			nextStageIn = preComp - elapsed;
		} else if (elapsed < preComp + comp) {
			stage = 'competition';
			nextStageIn = preComp + comp - elapsed;
		} else if (elapsed < preComp + comp + postComp) {
			nextStageIn = preComp + comp + postComp - elapsed;
			stage = 'post_competition';
		} else {
			stage = 'not_active';
		}

		return {stage: stage, nextStageIn: nextStageIn};
	};

	this._onTimer = function () {
		for (var i = 0; i < this.onTimerCallbacks.length; i++) {
			this.onTimerCallbacks[i]();
		}
	};

	this._setTimer = function (seconds) {
		this._timerDisplay.html(SecToTime(seconds));

		var expireDate = new Date();
		expireDate.setSeconds(expireDate.getSeconds() + seconds);

		var interval = setInterval(function () {
			var timeLeft = Math.round((expireDate.getTime() - new Date().getTime()) / 1000);

			_this._timerDisplay.html(SecToTime(timeLeft));

			if (timeLeft <= 0) {
				clearInterval(interval);
				_this._onTimer();
			}
		}, 1000);
	};
}