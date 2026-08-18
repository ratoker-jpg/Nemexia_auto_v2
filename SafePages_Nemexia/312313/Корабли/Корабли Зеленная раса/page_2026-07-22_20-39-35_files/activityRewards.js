function getActivityRewardsPopup() {
	if (window.activityRewardsPopup == undefined) {
		window.activityRewardsPopup = new ActivityRewardsPopup();
	}

	return window.activityRewardsPopup;
}

function ActivityRewardsPopup() {
	var _timer;
	var _this = this;
	var _timeLeft = undefined;
	var _url = 'ajax_activity_rewards.php';

	this.show = function() {
		$.post(_url, {
			type: 'activityRewardsLoadWindow'
		}, function(response){
			floatingEnable = 0;
			$("#dialogMessage").addClass('ActivityRewardsPopup');

			$("#dialogBox").html(response);

			$('#dialogMessage').fadeIn('fast');
			$('.black_overlay').show();

			_this.addEventListeners();
			_timeLeft = $('#activityRewards_timerHolder .countdown').attr('data-time-remaining');
			_this.timerTick();
		});
	}

	this.hide = function(callback) {
		$('#dialogMessage').fadeOut('slow', function() {
			$('.black_overlay').hide();
			$("#dialogMessage").removeClass('ActivityRewardsPopup');
			floatingEnable = 1;

			_this.removeEventListeners();
			_this.timerStop();

			executeCallback(callback);
		});
	}

	this.claimReward = function(type) {
		$.post(_url, {
			type: 'activityRewardsClaimReward',
			rewardType: type
		}, function(response){
			refreshSession('session');

			if (response.status == false) {
				_this.hide(function(){
					showDialogMessagePopup(response.message, function(){
						_this.show();
					});
				});
			} else {
				$('#ActivityRewardsButton').removeClass('active');
				_this.hide(function(){
					showDialogMessage(response.message);
					_this.notifyPopupQueues();
				});
			}
		}, 'json');
	}

	this.timerTick = function() {
		if (isNaN(_timeLeft) || _timeLeft == undefined) {
			return false;
		}

		if (_timeLeft <= 0) {
			$('#activityRewards_timerHolder').slideUp('slow', function(){
				_this.show()
			});
			return true;
		}

		$('#activityRewards_timerHolder .countdown').html(SecToTime(_timeLeft));

		_timeLeft--;
		_timer = setTimeout(_this.timerTick, 1000);

		return true;
	}

	this.timerStop = function() {
		clearTimeout(_timer);
		_timeLeft = undefined;
	}

	this.addEventListeners = function() {
		$('#activityRewards_closeButton, .black_overlay').bind('click', function(){
			_this.hide(function(){
				_this.notifyPopupQueues();
			});
		});

		$('.ActivityRewardsPopup .dayCard input').bind('click', function(){
			if ($(this).hasClass('inactive')) {
				return;
			}

			$(this).addClass('inactive');
			_this.claimReward($(this).parent().parent().attr('data-type'));
		});
	}

	this.removeEventListeners = function() {
		$('#activityRewards_closeButton, .black_overlay').unbind('click');
		$('.ActivityRewardsPopup .dayCard input').unbind('click');
	}

	this.notifyPopupQueues = function() {
		if(typeof LoginPopupsQueue == 'object') {
			LoginPopupsQueue.exec();
		}
	}

}