function RepairCenterManager(clientRaceId, purchaseCreditsBulkDiscount) {
	var _this = this;

	this._purchaseCreditsBulkDiscount = purchaseCreditsBulkDiscount;
	this._clientRaceId = clientRaceId;

	this._arenaTokensDisplay = $('.arenaTokensDisplay');
	this._popStatusDisplay = $('.statusContainer');
	this._storageEmptyDisplay = $('.repairCenterStorageEmpty');
	this._storageListDisplay = $('.repairCenterStorageList');
	this._batchesListDisplay = this._storageListDisplay.find('.batchesList');

	this._translations = {};
	this._batchesList = [];

	this.init = function() {
		this._addEventListeners();
		this._renderPopStatusDisplay();
		this._updateEnvironmentStats();
		this._loadBatchesList();
	};

	this.addTranslation = function(tag, value) {
		this._translations[tag] = value;
	};

	this.getTranslation = function(tag) {
		return this._translations[tag];
	};

	this.updateArenaTokens = function (value) {
		this._arenaTokensDisplay.find('span.value').html(number_format(value));
	};

	this._addEventListeners = function() {
		$(document).on('refreshSessionComplete', function() {
			_this._renderPopStatusDisplay();
			_this._updateEnvironmentStats();
			_this._evalBatches();
		});

		this._storageListDisplay.find('.controlsBulk .purchaseCredits')
				.bind('click', function() {
					var btnClicked = $(this);
					var batchesIdsList = [];
					var batchesCreditsSum = 0;
					var creditsPrice = 0;

					if (btnClicked.hasClass('inactive')) {
						return;
					}

					for (var i in _this._batchesList) {
						var batchData = _this._batchesList[i];

						if (_this._clientRaceId !== batchData.units_race) {
							continue;
						}

						batchesIdsList.push(batchData.id);
						batchesCreditsSum += batchData.price.credits;
					}

					creditsPrice = Math.max(1, Math.round(batchesCreditsSum * (1 - (_this._purchaseCreditsBulkDiscount / 100))));

					showConfirm(sprintf(_this.getTranslation('PURCHASE_CREDITS_CONFIRM'), number_format(creditsPrice)), function() {
						btnClicked.addClass('inactive');
						_this._repairBatches(batchesIdsList, 'credits', function() {
							btnClicked.removeClass('inactive');
						});
					});
				});
	};

	this._renderPopStatusDisplay = function() {
		var planetPopTotal = parseInt(PLAYER['pop']);

		this._popStatusDisplay.find('.popNumber.ships')
				.html(number_format(Math.max(planetPopTotal - parseInt(PLAYER['pop_used']), 0)));
		this._popStatusDisplay.find('.popNumber.defence')
				.html(number_format(Math.max(planetPopTotal - parseInt(PLAYER['defence_pop_used']), 0)));
	};

	this._renderStorageListlLoading = function() {
		this._batchesListDisplay.html('').append($('<div class="loadingAnimation" style="margin: auto;" />'));
	};

	this._renderStorageList = function() {
		this._batchesListDisplay.html('');

		var elemsBuffer = [];
		for (var i in this._batchesList) {
			var batchData = this._batchesList[i];
			elemsBuffer.push(this._generateBatchElem(batchData));
		}

		this._batchesListDisplay.append(elemsBuffer);
	};

	this._renderBatchDeath = function(batchId) {
		var batch = this._findBatchElemById(batchId);
		batch.hide('slide', function() {
			_this._removeBatch(batchId);
		});
	};

	this._removeBatch = function(batchId) {
		var i = this._batchesList.length;
		while (i--) {
			var batchData = this._batchesList[i];

			if (batchData.id !== batchId) {
				continue;
			}

			this._batchesList.splice(i, 1);
		}

		this._removeBatchTimer(batchId);
		this._findBatchElemById(batchId).remove();
		this._onBatchesListUpdate();
	};

	this._generateBatchElem = function(batchData) {
		var elem = this._storageListDisplay.find('.batchPrototypeContainer .singleBatch').clone();

		elem
				.addClass(batchData.units_type)
				.addClass('race_' + batchData.units_race)
				.attr('data-batch-id', batchData.id)
				.data('info', batchData);

		if (this._clientRaceId !== batchData.units_race) {
			elem.addClass('inactive');
		}

		elem.find('.unitInfo .unitsCount').html(number_format(batchData.units_count));
		elem.find('.unitsResources .price .metal').html(number_format(batchData.price.resources.metal));
		elem.find('.unitsResources .price .crystal').html(number_format(batchData.price.resources.crystal));
		elem.find('.unitsResources .price .gas').html(number_format(batchData.price.resources.gas));
		elem.find('.unitsResources .price .population').html(number_format(batchData.units_pop));
		elem.find('.unitInfo .unitsImage').css('background-image', "url('" + batchData.units_image_url + "')");
		elem.find('.timer').html(SecToTime(batchData.ttl));

		return elem;
	};

	this._findBatchElemById = function(batchId) {
		return this._batchesListDisplay.find('.singleBatch[data-batch-id=' + batchId + ']');
	};

	this._evalBatches = function() {
		var planetMetal = parseInt(PLAYER['metal']);
		var planetCrystal = parseInt(PLAYER['crystal']);
		var planetGas = parseInt(PLAYER['gas']);
		var planetPopFree = parseInt(PLAYER['pop']) - parseInt(PLAYER['pop_used']);

		this._batchesListDisplay.find('.singleBatch').each(function() {
			var batch = $(this);
			var batchData = batch.data('info');

			batch.find('.unitsResources .price div').removeClass('warning');

			if (batchData.price.resources.metal > planetMetal) {
				batch.find('.unitsResources .price .metal').addClass('warning');
			}

			if (batchData.price.resources.crystal > planetCrystal) {
				batch.find('.unitsResources .price .crystal').addClass('warning');
			}

			if (batchData.price.resources.gas > planetGas) {
				batch.find('.unitsResources .price .gas').addClass('warning');
			}

			if (batchData.units_pop > planetPopFree) {
				batch.find('.unitsResources .price .population').addClass('warning');
			}
		});
	};

	this._addBatchesEventListeners = function() {
		this._batchesListDisplay.find('.singleBatch .unitInfo .unitsImage')
				.bind('mouseover', function() {
					var batchData = $(this).parents('.singleBatch').data('info');
					Tip(batchData.units_name);
				})
				.bind('mouseout', function() {
					UnTip();
				});

		this._batchesListDisplay.find('.singleBatch .unitInfo .unitsType')
				.bind('mouseover', function() {
					var batchData = $(this).parents('.singleBatch').data('info');
					Tip(batchData.units_type_name);
				})
				.bind('mouseout', function() {
					UnTip();
				});

		this._batchesListDisplay.find('.singleBatch .unitInfo .unitsRace')
				.bind('mouseover', function() {
					var batchData = $(this).parents('.singleBatch').data('info');
					Tip(batchData.units_race_name);
				})
				.bind('mouseout', function() {
					UnTip();
				});

		this._batchesListDisplay.find('.singleBatch:not(.inactive) .unitsResources .purchase input')
				.bind('click', function() {
					var batchData = $(this).parents('.singleBatch').data('info');
					var btnClicked = $(this);

					if (btnClicked.hasClass('inactive')) {
						return;
					}

					btnClicked.addClass('inactive');
					_this._repairBatches([batchData.id], 'resources', function() {
						btnClicked.removeClass('inactive');
					});
				});

		this._batchesListDisplay.find('.singleBatch:not(.inactive) .controls input.purchaseCredits')
				.bind('click', function() {
					var batchData = $(this).parents('.singleBatch').data('info');
					var btnClicked = $(this);

					if (btnClicked.hasClass('inactive')) {
						return;
					}

					showConfirm(sprintf(_this.getTranslation('PURCHASE_CREDITS_CONFIRM'), number_format(batchData.price.credits)), function() {
						btnClicked.addClass('inactive');
						_this._repairBatches([batchData.id], 'credits', function() {
							btnClicked.removeClass('inactive');
						});
					});
				});

		this._batchesListDisplay.find('.singleBatch:not(.inactive) .controls input.purchaseArenaTokens')
				.bind('click', function () {
					var batchData = $(this).parents('.singleBatch').data('info');
					var btnClicked = $(this);

					if (btnClicked.hasClass('inactive')) {
						return;
					}

					showConfirm(sprintf(_this.getTranslation('PURCHASE_ARENA_TOKENS_CONFIRM'), number_format(batchData.price.credits)), function () {
						btnClicked.addClass('inactive');
						_this._repairBatches([batchData.id], 'arena_tokens', function () {
							btnClicked.removeClass('inactive');
						});
					});
				});
	};

	this._addBatchesTimers = function() {
		this._batchesListDisplay.find('.singleBatch').each(function() {
			var batch = $(this);
			var batchData = batch.data('info');
			var batchTimerDisplay = batch.find('.timer');

			var expireDate = new Date();
			expireDate.setSeconds(expireDate.getSeconds() + batchData.ttl);

			var interval = setInterval(function() {
				var timeLeft = Math.round((expireDate.getTime() - new Date().getTime()) / 1000);

				batchTimerDisplay.html(SecToTime(timeLeft));

				if (timeLeft === 10) {
					batchTimerDisplay.effect('shake', {direction: 'up', distance: 2, times: 2});
				} else if (timeLeft <= 0) {
					clearInterval(interval);
					_this._renderBatchDeath(batchData.id);
				}
			}, 1000);

			batchData.timerInterval = interval;
		});
	};

	this._removeBatchTimer = function(batchId) {
		var batch = this._findBatchElemById(batchId);
		var batchData = batch.data('info');

		clearInterval(batchData.timerInterval);
	};

	this._removeBatchesTimers = function() {
		for (var i in this._batchesList) {
			var batchData = this._batchesList[i];
			clearInterval(batchData.timerInterval);
		}
	};

	this._onBatchesListUpdate = function() {
		if (this._batchesList.length <= 0) {
			this._storageEmptyDisplay.show();
			this._storageListDisplay.hide();
		} else {
			this._storageEmptyDisplay.hide();
			this._storageListDisplay.show();

			var batchesClientRaceCount = 0;
			for (var i in this._batchesList) {
				var batchData = this._batchesList[i];

				if (this._clientRaceId !== batchData.units_race) {
					continue;
				}

				batchesClientRaceCount++;
			}

			if (batchesClientRaceCount > 1) {
				this._storageListDisplay.find('.controlsBulk').show();
			} else {
				this._storageListDisplay.find('.controlsBulk').hide();
			}
		}
	};

	this._clearBatchesList = function() {
		this._removeBatchesTimers();
		this._renderStorageListlLoading();
	};

	this._renderBatchesList = function() {
		this._renderStorageList();
		this._evalBatches();

		this._addBatchesEventListeners();
		this._addBatchesTimers();
	};

	this._loadBatchesList = function() {
		this._clearBatchesList();

		$.post('ajax_repair_center.php?uid=' + (new Date()).valueOf(), {
			type: 'getBatchesList'
		}, function(response) {
			if (response.status === false) {
				showDialogMessagePopup(response.message);
				return;
			}

			_this._batchesList = response.list;
			_this._onBatchesListUpdate();

			_this._renderBatchesList();
		}, 'json');
	};

	this._repairBatches = function(batchesIdsList, currency, onResponseCallback) {
		$.post('ajax_repair_center.php?uid=' + (new Date()).valueOf(), {
			type: 'repairBatches',
			batchesIdsList: batchesIdsList,
			currency: currency
		}, function(response) {
			refreshSession('session');
			executeCallback(onResponseCallback);

			if (response.status === false) {
				if (response.forceBatchesReload === true) {
					_this._loadBatchesList();
				}

				showDialogMessagePopup(response.message);
				return;
			}

			if (batchesIdsList.length === 1) {
				_this._renderBatchDeath(batchesIdsList[0]);
			} else {
				_this._loadBatchesList();
			}

			showDialogMessage(response.message);
		}, 'json');
	};

	this._updateEnvironmentStats = function () {
		$.post('ajax_repair_center.php?uid=' + (new Date()).valueOf(), {
			type: 'getEnvironmentStats'
		}, function (response) {
			_this.updateArenaTokens(response.arenaTokens);
		}, 'json');
	};
}