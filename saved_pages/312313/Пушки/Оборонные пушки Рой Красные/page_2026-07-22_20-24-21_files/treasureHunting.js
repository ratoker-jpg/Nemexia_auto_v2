$(document).ready(function() {
	if (TREASURE_HUNTING_THEME !== '') {
		getTreasureHunting().showRewardsPopupPageLabel();
	}
});

function getTreasureHunting() {
	if (window.treasureHunting === undefined) {
		window.treasureHunting = new TreasureHunting(TREASURE_HUNTING_THEME);
		window.treasureHunting.addTranslation('TREASURE_HUNTING_TITLE', TREASURE_HUNTING_TITLE);
	}

	return window.treasureHunting;
}

function TreasureHunting(theme) {
	var _this = this;

	this._theme = theme;
	this._translations = {};
	this._closeCallback = false;

	this.addTranslation = function(tag, value) {
		this._translations[tag] = value;
		return this;
	};

	this.getTranslation = function(tag) {
		return this._translations[tag];
	};

	this.showRewardsPopup = function(closeCallback) {
		if (closeCallback !== undefined) {
			this._closeCallback = closeCallback;
		}

		$.post('ajax_treasure_hunting.php?uid=' + (new Date()).valueOf(), {
			type: 'getRewardsPopup'
		}, function(response) {
			if (response.status === false) {
				_this._removePopup(function() {
					showDialogMessagePopup(response.message, function() {
						_this._closePopup();
					});
				});
				return;
			}

			_this._renderPopup('rewards', response.content);
			_this._addRewardsPopupEventListeners();
			_this._updateRewardsPopupPurchaseButtons();
		}, 'json');

		return this;
	};

	this.showDescriptionPopup = function(closeCallback) {
		if (closeCallback !== undefined) {
			this._closeCallback = closeCallback;
		}

		$.post('ajax_treasure_hunting.php?uid=' + (new Date()).valueOf(), {
			type: 'getDescriptionPopup'
		}, function(response) {
			if (response.status === false) {
				_this._removePopup(function() {
					showDialogMessagePopup(response.message, function() {
						_this._closePopup();
					});
				});
				return;
			}

			_this._renderPopup('description', response.content);
			_this._saveDescriptionPopupVisitedStatus(true);
		}, 'json');

		return this;
	};

	this.showRewardsPopupPageLabel = function() {
		if ($('.pageSubnavigation').length <= 0) {
			return;
		}

		$('.pageSubnavigation').first().append(
				$('<div />')
				.addClass('treasureHunting')
				.addClass(this._theme)
				.bind('mouseover', function() {
					Tip(_this.getTranslation('TREASURE_HUNTING_TITLE'));
				})
				.bind('mouseout', function() {
					UnTip();
				})
				.bind('click', function() {
					_this.showRewardsPopup();
				}));

		return this;
	};

	this._purchasePackage = function(size) {
		var buttonsElems = $('.treasureHuntingPopup.rewards .packagesPurchase .package .button');

		buttonsElems.addClass('inactive');
		$.post('ajax_treasure_hunting.php?uid=' + (new Date()).valueOf(), {
			type: 'purchasePackage',
			size: size
		}, function(response) {
			buttonsElems.removeClass('inactive');
			if (response.status === false) {
				_this._removePopup(function() {
					showDialogMessagePopup(response.message, function() {
						_this.showRewardsPopup();
					});
				});
				return;
			}

			_this._updateRewardsPopupCoinsDisplay(response.playerCoins);
			_this._updateRewardsPopupPurchaseButtons();
			_this._renderRewardsPopupRewardsWonPanel(response.rewardsWon);

			refreshSession('session');
		}, 'json');

		return this;
	};

	this._purchaseCoins = function() {
		$.post('ajax_treasure_hunting.php?uid=' + (new Date()).valueOf(), {
			type: 'purchaseCoins'
		}, function(response) {
			if (response.status === false) {
				showDialogMessagePopup(response.message, function() {
					_this.showRewardsPopup();
				});
			} else {
				showDialogMessage(response.message);
				_this.showRewardsPopup();
			}

			refreshSession('session');
		}, 'json');

		return this;
	};

	this._saveDescriptionPopupVisitedStatus = function(status) {
		createCookie('TreasureHunting_Visited_' + this._theme, status, 30);
		return this;
	};

	this._updateRewardsPopupCoinsDisplay = function(value) {
		var coinsDisplay = $('.treasureHuntingPopup.rewards .header .coins .display');

		coinsDisplay.attr('data-value', value);
		updateValueAnimated(coinsDisplay, number_format(value));

		return this;
	};

	this._updateRewardsPopupPurchaseButtons = function() {
		var coinsDisplay = $('.treasureHuntingPopup.rewards .header .coins .display');

		$('.treasureHuntingPopup.rewards .packagesPurchase .package .button').each(function() {
			if (parseInt(coinsDisplay.attr('data-value')) < parseInt($(this).parent().attr('data-price'))) {
				$(this).addClass('inactive');
			} else {
				$(this).removeClass('inactive');
			}
		});

		return this;
	};

	this._addRewardsPopupEventListeners = function() {
		$('.treasureHuntingPopup.rewards .header .title').bind('click', function() {
			_this.showDescriptionPopup();
		});

		$('.treasureHuntingPopup.rewards .header .reward').bind('mouseover', function() {
			Tip($(this).attr('data-name'));
		}).bind('mouseout', function() {
			UnTip();
		});

		$('.treasureHuntingPopup.rewards .header .coins').bind('mouseover', function() {
			Tip(_this.getTranslation('TREASURE_HUNTING_COINS_TOOLTIP'));
		}).bind('mouseout', function() {
			UnTip();
		});

		$('.treasureHuntingPopup.rewards .header .coins .button').bind('click', function() {
			_this._removePopup(function() {
				showConfirm(_this.getTranslation('TREASURE_HUNTING_COINS_PURCHASE_CONFIRM'), function() {
					_this._purchaseCoins();
				}, function() {
					_this.showRewardsPopup();
				});
			});
		});

		$('.treasureHuntingPopup.rewards .packagesPurchase .package').bind('mouseover', function() {
			Tip($(this).attr('data-tooltip'));
			_this._highlightRewardsPopupRewards($(this).attr('data-size'));
		}).bind('mouseout', function() {
			UnTip();
			_this._highlightRewardsPopupRewards();
		});

		$('.treasureHuntingPopup.rewards .packagesPurchase .package .button').bind('click', function() {
			if ($(this).hasClass('inactive')) {
				return;
			}

			_this._purchasePackage($(this).parent().attr('data-size'));
		});

		$('.treasureHuntingPopup.rewards .packagesPurchase .rewardsWon .buttonrow input').bind('click', function() {
			_this._showRewardsPopupPanel('purchase');
		});
	};

	this._highlightRewardsPopupRewards = function(size) {
		if (size === undefined) {
			$('.treasureHuntingPopup.rewards .header .reward').removeClass('highlight');
			return;
		}

		$('.treasureHuntingPopup.rewards .packagesPurchase .package.' + size + ' .contents div').each(function() {
			$('.treasureHuntingPopup.rewards .header .reward.' + $(this).html()).addClass('highlight');
		});
	};

	this._showRewardsPopupPanel = function(panelName) {
		var purchasePanel = $('.treasureHuntingPopup.rewards .packagesPurchase .packages');
		var rewardsWonPanel = $('.treasureHuntingPopup.rewards .packagesPurchase .rewardsWon');

		if (panelName === 'purchase') {
			rewardsWonPanel.hide('slide', function() {
				purchasePanel.show('slide');
			});
		} else if (panelName === 'rewardsWon') {
			purchasePanel.hide('slide', function() {
				rewardsWonPanel.show('slide');
			});
		}
	};

	this._renderRewardsPopupRewardsWonPanel = function(rewards) {
		var rewardsWonPanel = $('.treasureHuntingPopup.rewards .packagesPurchase .rewardsWon');

		rewardsWonPanel.find('.list').html('');
		for (i in rewards) {
			var rewardInfo = rewards[i];

			var rewardElem = $('<div />')
					.addClass('reward')
					.addClass(rewardInfo.key)
					.css('display', 'none')
					.delay(500 + (i * 750))
					.show('fade')
					.attr('data-name', rewardInfo.name)
					.append($('<div />').addClass('preview'))
					.append($('<div />').addClass('button').html(number_format(rewardInfo.value)))
					.bind('mouseover', function() {
						Tip($(this).attr('data-name'));
					})
					.bind('mouseout', function() {
						UnTip();
					});
			rewardsWonPanel.find('.list').append(rewardElem);
		}

		rewardsWonPanel.find('.list').append($('<div />').css('clear', 'both'));

		this._showRewardsPopupPanel('rewardsWon');
	};

	this._renderPopup = function(type, content) {
		floatingEnable = 0;
		$('.black_overlay').show();
		$("#dialogBox").html(content);
		$("#dialogMessage")
				.addClass('treasureHuntingPopup')
				.addClass(this._theme)
				.removeClass('rewards')
				.removeClass('description')
				.addClass(type)
				.fadeIn('fast');

		$('#treasureHuntingPopup_closeButton, .black_overlay').bind('click', function() {
			_this._closePopup();
		});

		return this;
	};

	this._closePopup = function() {
		this._removePopup(function() {
			executeCallback(_this._closeCallback);
			_this._closeCallback = false;
		});

		return this;
	};

	this._removePopup = function(callback) {
		$('#dialogMessage').fadeOut('slow', function() {
			floatingEnable = 1;
			$('.black_overlay').hide();
			$("#dialogMessage")
					.removeClass('treasureHuntingPopup')
					.removeClass(_this._theme)
					.removeClass('rewards')
					.removeClass('description');

			$('#treasureHuntingPopup_closeButton, .black_overlay').unbind('click');

			executeCallback(callback);
		});

		return this;
	};
}