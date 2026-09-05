function AdmiralBlueprintsAssemblyManager(isTeam, isSitter, blueprintsManager, assemblyDisplaySelector) {
	var _this = this;

	this.translations = {};
	this.isTeam = isTeam;
	this.isSitter = isSitter;
	this.blueprintsManager = blueprintsManager;
	this.mainDsplay = $(assemblyDisplaySelector);
	this.mapDisplay = this.mainDsplay.find('.segmentsMap');

	this.renderedSegmentsMaps = {};

	this.init = function() {
		this._addBlueprintsListEventListeners();
	};

	this.addTranslation = function(tag, value) {
		this.translations[tag] = value;
	};

	this.getTranslation = function(tag) {
		return this.translations[tag];
	};

	this._addBlueprintsListEventListeners = function() {
		this.blueprintsManager.addOnBlueprintsSetsListUpdateCallback(function() {
			_this._showFirstBlueprint();
		});

		this.blueprintsManager.addOnBlueprintsSetsStateUpdateCallback(function() {
			var productKey = _this.mapDisplay.attr('data-product-key');
			if (!productKey) {
				return;
			}

			_this._renderSegmentsMap(_this._getBlueprintData(productKey), true);
		});

		this.blueprintsManager.addOnBlueprintsSetsClickCallback(function(blueprintElem) {
			var blueprintData = blueprintElem.data('info');
			if (blueprintData.is_highlighted) {
				return;
			}

			_this._showBlueprint(blueprintData);
		});
	};

	this._addSegmentsMapEventListeners = function() {
		var productKey = _this.mapDisplay.attr('data-product-key');

		this.mapDisplay.find('.segment .fill').bind('mouseover', function() {
			Tip(_this.getTranslation('SEGMENT_COLLECT_ALL_TIP'));
		});

		this.mapDisplay.find('.segment .fill').bind('mouseout', function() {
			UnTip();
		});

		this.mapDisplay.find('.segment .overhead').bind('mouseover', function() {
			Tip(sprintf(_this.getTranslation('SEGMENT_OVERHEAD_TIP'), 2, 1));
		});

		this.mapDisplay.find('.segment .overhead').bind('mouseout', function() {
			UnTip();
		});

		this.mapDisplay.find('.segment .purchaseBtn').bind('click', function() {
			var segmentIndex = parseInt($(this).parent().attr('data-index'));
			var blueprintData = _this._getBlueprintData(productKey);

			showConfirm(sprintf(_this.getTranslation('SEGMENT_PURCHASE_CREDITS_CONFIRM'), segmentIndex + 1, blueprintData.segment_cost_credits), function() {
				_this._purchaseBlueprintSegment(blueprintData.product_key, segmentIndex);
			});
		});

		this.mapDisplay.find('.assembleBtn').bind('click', function() {
			_this.mapDisplay.find('.layer.segmentsList').hide('fold', {}, 1000, function() {
				_this.blueprintsManager.setBlueprintSetAssembled(productKey);
			});
		});

		this.mapDisplay.find('.tradeBtn').bind('mouseover', function() {
			Tip(sprintf(_this.getTranslation('BLUEPRINT_TRADE_BTN_TIP'), 2, 1));
		});

		this.mapDisplay.find('.tradeBtn').bind('mouseout', function() {
			UnTip();
		});

		this.mapDisplay.find('.tradeBtn').bind('click', function() {
			if ($(this).hasClass('inactive')) {
				return;
			}

			_this.tradeDuplicateSegments(productKey);
		});
	};

	this._showFirstBlueprint = function() {
		var firstBlueprintData = this.blueprintsManager.getBlueprintsSetsSortedList().shift();
		this._showBlueprint(firstBlueprintData);
	};

	this._showBlueprint = function(blueprintData) {
		this.blueprintsManager.highlightBlueprint(blueprintData.product_key);
		this._loadBlueprintProductInfo(blueprintData.product_key);

		this.mainDsplay.stop().hide('fade', 250, function() {
			_this.mainDsplay.find('h2.productName').html(blueprintData.name_translated);
			_this._renderSegmentsMap(blueprintData, false);
			_this.mainDsplay.show('fade', 650);
		});
	};

	this._renderSegmentsMap = function(blueprintData, isUpdate) {
		var nonEmptySegmentsCount = blueprintData.segments_map.filter(function(count) {
			return count ? true : false;
		}).length;

		var overheadSegmentsCount = blueprintData.segments_map.reduce(function(previousValue, currentValue) {
			return currentValue + previousValue;
		}) - nonEmptySegmentsCount;

		if (this.renderedSegmentsMaps[blueprintData.product_key] === undefined) {
			this.renderedSegmentsMaps[blueprintData.product_key] = blueprintData.segments_map.slice();
		}

		this.mapDisplay
				.removeClass()
				.addClass('segmentsMap')
				.addClass(blueprintData.product_key)
				.attr('data-product-key', blueprintData.product_key);

		this.mapDisplay.find('.layer.segmentsList').attr('style', '').html('');

		this.mapDisplay.find('.layer.assemble').attr('style', '').html('').append(
				$('<input />')
				.addClass('assembleBtn')
				.attr('type', 'button')
				.attr('value', this.getTranslation('BLUEPRINT_ASSEMBLE_BTN_LBL')));

		this.mapDisplay.find('.layer.trade').attr('style', '').html('').append(
				$('<input />')
				.addClass('tradeBtn')
				.attr('type', 'button')
				.attr('value', sprintf(this.getTranslation('BLUEPRINT_TRADE_BTN_LBL'), 2, 1)));

		blueprintData.is_assembled ? this.mapDisplay.addClass('assembled') : this.mapDisplay.removeClass('assembled');
		!blueprintData.is_assembled && nonEmptySegmentsCount === blueprintData.segments_map.length && !this.isTeam ? this.mapDisplay.find('.layer.assemble').show('fade') : this.mapDisplay.find('.layer.assemble').hide();
		overheadSegmentsCount < 2 ? this.mapDisplay.find('.tradeBtn').addClass('inactive') : this.mapDisplay.find('.tradeBtn').removeClass('inactive');
		!blueprintData.is_assembled && !this.isTeam ? this.mapDisplay.find('.tradeBtn').show() : this.mapDisplay.find('.tradeBtn').hide();

		for (var i = 0; i < blueprintData.segments_map.length; i++) {
			var segmentCount = blueprintData.segments_map[i];

			var segmentElem = $('<div/>').addClass('segment').attr('data-index', i)
					.append($('<div/>').addClass('fill'))
					.append($('<div/>').addClass('overhead'))
					.append($('<input/>').addClass('purchaseBtn').attr('type', 'button'));
			this.mapDisplay.find('.layer.segmentsList').append(segmentElem);

			nonEmptySegmentsCount > 0 && segmentCount <= 0 && !this.isTeam && !this.isSitter ? segmentElem.find('.purchaseBtn').show() : segmentElem.find('.purchaseBtn').hide();

			if (segmentCount > 0) {
				if (this.renderedSegmentsMaps[blueprintData.product_key][i] < 1) {
					segmentElem.find('.fill').stop().show().hide('slide', 750);
				} else {
					segmentElem.find('.fill').hide();
				}
			} else {
				segmentElem.find('.fill').show();
			}

			if (segmentCount > 1 && !this.isTeam) {
				var overheadText = '+' + number_format(segmentCount - 1);
				if (isUpdate && this.renderedSegmentsMaps[blueprintData.product_key][i] !== blueprintData.segments_map[i]) {
					updateValueAnimated(segmentElem.find('.overhead'), overheadText);
				} else {
					segmentElem.find('.overhead').html(overheadText).show();
				}
			} else {
				segmentElem.find('.overhead').html('').hide();
			}
		}

		this.renderedSegmentsMaps[blueprintData.product_key] = blueprintData.segments_map.slice();
		this._addSegmentsMapEventListeners();
	};

	this._loadBlueprintProductInfo = function(productKey) {
		$.post('ajax_admiral_blueprints.php?uid=' + (new Date()).valueOf(), {
			type: 'getBlueprintProductInfo',
			productKey: productKey
		}, function(response) {
			_this.mainDsplay.find('.productStatsBox, .productDescriptionBox').html('');
			_this.mainDsplay.find('.productStatsBox').html(response.stats);
			_this.mainDsplay.find('.productDescriptionBox').html(response.description);
		}, 'json');
	};

	this._purchaseBlueprintSegment = function(productKey, segmentIndex) {
		$.post('ajax_admiral_blueprints.php?uid=' + (new Date()).valueOf(), {
			type: 'purchaseBlueprintSegment',
			productKey: productKey,
			segmentIndex: segmentIndex
		}, function(response) {
			refreshSession('session');

			if (response.status === false) {
				showDialogMessagePopup(response.message);
				return;
			}

			_this.blueprintsManager.addSegmentToBlueprintSet(productKey, segmentIndex, 1);
		}, 'json');
	};



	this.tradeDuplicateSegments = function(productKey) {
		this.mapDisplay.find('.tradeBtn').addClass('inactive');
		$.post('ajax_admiral_blueprints.php?uid=' + (new Date()).valueOf(), {
			type: 'tradeDuplicateBlueprintSegments',
			productKey: productKey
		}, function(response) {
			_this.mapDisplay.find('.tradeBtn').removeClass('inactive');

			if (response.status === false) {
				showDialogMessagePopup(response.message);
				return;
			}

			_this.blueprintsManager.updateSegmentsMapInBlueprintSet(productKey, response.segments_map);
		}, 'json');
	};

	this._getBlueprintData = function(productKey) {
		return _this.blueprintsManager.findBlueprintSetByProductKey(productKey).data('info');
	};
}