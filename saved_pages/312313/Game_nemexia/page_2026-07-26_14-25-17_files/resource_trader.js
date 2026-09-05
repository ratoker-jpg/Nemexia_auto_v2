function ResourceTrader(exchangeRates, purchaseContractCreditsPrice) {
	var _this = this;

	this._purchaseContractCreditsPrice = purchaseContractCreditsPrice;
	this._exchangeRates = exchangeRates;
	this._maxExchangeValue = 0;
	this._leftExchangeDealsCount = 0;
	this._contractsBalance = 0;
	this._planetResources = {metal: 0, crystal: 0, gas: 0, recycle: 0};

	this._statsDisplay = $('.resourceTraderStatsDisplay');
	this._resourceFromItems = $('.resourceTrader .resourceSelection.resourceFrom li');
	this._resourceToItems = $('.resourceTrader .resourceSelection.resourceTo li');
	this._resourceExchangeRateDisplay = $('.resourceTrader .resourceSelection.ratio .display');

	this._resourceFromValueInput = $('.resourceTrader .resourceSelection.resourceFrom .inputBox input');
	this._resourceToValueDisplay = $('.resourceTrader .resourceSelection.resourceTo .inputBox input');

	this._resourceFromValueSlider = $('.resourceTrader .sliderBox .ui-slider');

	this._resourceExchangeButton = $('.resourceTrader .controls .exchange');
	this._contractsPurchaseButton = $('.resourceTrader .controls .purchaseContracts');

	this._cooldownTimerDisplay = $('.resourceTrader .cooldown .timer');

	this._translations = {};

	this.init = function() {
		initializeSlider(this._resourceFromValueSlider.attr('id'), 0);

		this._addEventListeners();
		this._cachePlanetResources();
	};

	this.addTranslation = function(tag, value) {
		this._translations[tag] = value;
	};

	this.getTranslation = function(tag) {
		return this._translations[tag];
	};

	this.updateMaxExchangeValue = function(value) {
		this._maxExchangeValue = value;
		this._statsDisplay.find('.maxExchangeValue span.value').html(number_format(value));
		this._renderResourceFromValueSlider(false);
	};

	this.updateLeftExchangeDealsCount = function(value, timeUntilCountRefill) {
		this._leftExchangeDealsCount = value;
		this._statsDisplay.find('.leftExchangeDealsCount span.value').html(number_format(value));
		this._renderResourceExchangeButton();
		this._renderCooldownTimer(value <= 0 ? true : false, timeUntilCountRefill);
	};

	this.updateContractsBalance = function(value) {
		this._contractsBalance = value;
		this._statsDisplay.find('.contractsBalance span.value').html(number_format(value));
		this._renderResourceExchangeButton();
		this._renderContractsPurchaseButton();
	};

	this.setResourceExchangeTypes = function(fromType, toType, updateFromValue) {
		this._resourceFromItems.removeClass('selected');
		this._resourceFromItems.filter('[data-type=' + fromType + ']').addClass('selected');

		this._resourceToItems.removeClass('selected').removeClass('inactive');
		this._resourceToItems.filter('[data-type=' + toType + ']').addClass('selected');
		this._resourceToItems.filter('[data-type=' + fromType + ']').addClass('inactive');

		this._resourceExchangeRateDisplay.find('.to').html(this._exchangeRates[fromType][toType]);

		if (updateFromValue) {
			this._renderResourceFromValueSlider(true);
		}
	};

	this._cachePlanetResources = function() {
		this._planetResources.metal = parseInt(PLAYER['metal']);
		this._planetResources.crystal = parseInt(PLAYER['crystal']);
		this._planetResources.gas = parseInt(PLAYER['gas']);
		this._planetResources.recycle = parseInt(PLAYER['recycle']);
	};

	this._addEventListeners = function() {
		this._resourceFromItems.bind('click', function() {
			var btnClicked = $(this);

			if (btnClicked.hasClass('selected')) {
				return;
			}

			var selectedType = btnClicked.attr('data-type');
			var selectedPairType = _this._resourceToItems.filter('.selected').attr('data-type');

			if (selectedPairType === selectedType) {
				_this.setResourceExchangeTypes(selectedType, btnClicked.attr('data-default-pair-type'), true);
			} else {
				_this.setResourceExchangeTypes(selectedType, selectedPairType, true);
			}
		});

		this._resourceToItems.bind('click', function() {
			var btnClicked = $(this);

			if (btnClicked.hasClass('selected') || btnClicked.hasClass('inactive')) {
				return;
			}

			_this.setResourceExchangeTypes(_this._resourceFromItems.filter('.selected').attr('data-type'), btnClicked.attr('data-type'), false);
		});

		this._resourceFromValueSlider.bind('slide slidechange', function() {
			_this._resourceFromValueInput.val(_this._resourceFromValueSlider.slider('option', 'value'));
			_this._renderResourceToValueDisplay();
			_this._renderResourceExchangeButton();
		});

		this._resourceFromValueSlider.parent().find('.slideLeft, .slideRight').bind('click', function() {
			var btnClicked = $(this);
			var delta = Math.ceil(_this._resourceFromValueSlider.slider('option', 'max') * (parseInt(btnClicked.attr('data-percent')) / 100)) * parseInt(btnClicked.attr('data-direction'));
			sliderMoveTo(_this._resourceFromValueSlider.attr('id'), delta);
		});

		this._resourceFromValueInput.bind('keyup', function() {
			var field = $(this);
			sliderMoveOn(_this._resourceFromValueSlider.attr('id'), field.val());
		});

		this._resourceFromValueInput.bind('keydown', function(event) {
			var field = $(this);
			var newValue = field.val();

			if (event.which === 38) {
				newValue++;
			} else if (event.which === 40) {
				newValue--;
			}

			sliderMoveOn(_this._resourceFromValueSlider.attr('id'), newValue);
		});

		this._resourceExchangeButton.bind('click', function() {
			var btnClicked = $(this);

			if (btnClicked.hasClass('inactive')) {
				return;
			}

			btnClicked.addClass('inactive');
			_this._exchangeResources(function() {
				btnClicked.removeClass('inactive');
			});
		});

		this._contractsPurchaseButton.bind('click', function() {
			var btnClicked = $(this);

			if (btnClicked.hasClass('inactive')) {
				return;
			}

			showConfirm(sprintf(_this.getTranslation('PURCHASE_CONTRACT_CREDITS_CONFIRM'), 1, number_format(_this._purchaseContractCreditsPrice)), function() {
				btnClicked.addClass('inactive');

				_this._purchaseContract(function() {
					btnClicked.removeClass('inactive');
				});
			});
		});
	};

	this._renderResourceFromValueSlider = function(setToMax) {
		var fromType = this._resourceFromItems.filter('.selected').attr('data-type');
		var maxFromValue = Math.min(this._planetResources[fromType], this._maxExchangeValue);

		if (fromType === undefined) {
			return;
		}

		sliderSetMax(this._resourceFromValueSlider.attr('id'), maxFromValue);

		if (setToMax || this._resourceFromValueSlider.slider('option', 'value') > maxFromValue) {
			sliderMoveOn(this._resourceFromValueSlider.attr('id'), maxFromValue);
		}
	};

	this._renderResourceToValueDisplay = function() {
		var fromType = this._resourceFromItems.filter('.selected').attr('data-type');
		var toType = this._resourceToItems.filter('.selected').attr('data-type');
		var newValue = Math.round(this._resourceFromValueSlider.slider('option', 'value') * this._exchangeRates[fromType][toType]);

		this._resourceToValueDisplay.val(newValue);
	};

	this._renderResourceExchangeButton = function() {
		if (this._contractsBalance < 1 || this._leftExchangeDealsCount < 1 || this._resourceFromValueSlider.slider('option', 'value') <= 0) {
			this._resourceExchangeButton.addClass('inactive');
		} else {
			this._resourceExchangeButton.removeClass('inactive');
		}
	};

	this._renderContractsPurchaseButton = function() {
		if (this._contractsBalance > 0) {
			this._contractsPurchaseButton.hide('slide', {direction: 'left'});
		} else {
			this._contractsPurchaseButton.show('slide', {direction: 'left'});
		}
	};

	this._renderCooldownTimer = function(active, seconds) {
		clearInterval(this._cooldownTimerDisplay.data('timerInterval'));
		this._cooldownTimerDisplay.find('.value').html(SecToTime(seconds));

		if (active) {
			var expireDate = new Date();
			expireDate.setSeconds(expireDate.getSeconds() + seconds);

			var interval = setInterval(function() {
				var timeLeft = Math.round((expireDate.getTime() - new Date().getTime()) / 1000);
				_this._cooldownTimerDisplay.find('.value').html(SecToTime(timeLeft));

				if (timeLeft <= 0) {
					clearInterval(interval);
					_this._renderCooldownTimer(false, 0);
					_this._updateEnvironmentStats();
				}
			}, 1000);

			this._cooldownTimerDisplay.data('timerInterval', interval);
			this._cooldownTimerDisplay.parents('.row').show('slide', {direction: 'up'});
		} else {
			this._cooldownTimerDisplay.parents('.row').hide('slide', {direction: 'up'});
		}
	};

	this._exchangeResources = function(onResponseCallback) {
		var formValue = this._resourceFromValueSlider.slider('option', 'value');
		var fromType = this._resourceFromItems.filter('.selected').attr('data-type');
		var toType = this._resourceToItems.filter('.selected').attr('data-type');

		$.post('ajax_resource_trader.php?uid=' + (new Date()).valueOf(), {
			type: 'exchangeResources',
			'resourceFromValue': formValue,
			'resourceFromType': fromType,
			'resourceToType': toType
		}, function(response) {
			_this._updateEnvironmentStats();
			executeCallback(onResponseCallback);

			if (response.status === false) {
				showDialogMessagePopup(response.message);
				return;
			}

			showDialogMessage(response.message);
		}, 'json');
	};

	this._updateEnvironmentStats = function() {
		$.post('ajax_resource_trader.php?uid=' + (new Date()).valueOf(), {
			type: 'getEnvironmentStats'
		}, function(response) {
			refreshSession('session', function() {
				_this._cachePlanetResources();

				_this.updateContractsBalance(response.contractsBalance);
				_this.updateLeftExchangeDealsCount(response.leftExchangeDealsCount, response.timeUntilExchangeDealsCountRefill);
				_this.updateMaxExchangeValue(response.maxExchangeValue);
			});
		}, 'json');
	};

	this._purchaseContract = function(onResponseCallback) {
		$.post('ajax_resource_trader.php?uid=' + (new Date()).valueOf(), {
			type: 'purchaseContract'
		}, function(response) {
			_this._updateEnvironmentStats();
			executeCallback(onResponseCallback);

			if (response.status === false) {
				showDialogMessagePopup(response.message);
				return;
			}

			showDialogMessage(response.message);
		}, 'json');
	};
}