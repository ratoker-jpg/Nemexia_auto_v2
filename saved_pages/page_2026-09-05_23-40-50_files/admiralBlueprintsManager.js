function AdmiralBlueprintsManager(xscarousel) {
	var _this = this;

	this.xscarousel = xscarousel;
	this.translations = {};
	this.onBlueprintsSetsListUpdateCallbacks = [];
	this.onBlueprintsSetsStateUpdateCallbacks = [];
	this.onBlueprintsSetsClickCallbacks = [];
	this.blueprintsSetsList = {};

	this.init = function() {
		this.addOnBlueprintsSetsListUpdateCallback(function() {
			_this._renderCarousel();
			_this._evalBlueprintSets();
			_this._addBlueprintSetEventListeners();
		});

		this.addOnBlueprintsSetsStateUpdateCallback(function() {
			_this._evalBlueprintSets();
		});

		this._load();
	};

	this.addTranslation = function(tag, value) {
		this.translations[tag] = value;
	};

	this.getTranslation = function(tag) {
		return this.translations[tag];
	};

	this.addOnBlueprintsSetsListUpdateCallback = function(callback) {
		this.onBlueprintsSetsListUpdateCallbacks.push(callback);
	};

	this.addOnBlueprintsSetsStateUpdateCallback = function(callback) {
		this.onBlueprintsSetsStateUpdateCallbacks.push(callback);
	};

	this.addOnBlueprintsSetsClickCallback = function(callback) {
		this.onBlueprintsSetsClickCallbacks.push(callback);
	};

	this.generateBlueprintSetElem = function(blueprintSetData) {
		return $('<div class="admiralBlueprintItem"/>')
				.addClass(blueprintSetData.product_key)
				.append('<div class="preview">')
				.append('<div class="progress">\n\
									<div class="bar">\n\
										<div class="scale"></div>\n\
										<div class="mask"></div>\n\
									</div>\n\
									<div class="assembledBtn"></div>\n\
							</div>')
				.data('info', blueprintSetData);
	};

	this.highlightBlueprint = function(productKey) {
		var blueprintElem = this.findBlueprintSetByProductKey(productKey);
		var pageNumber = this.xscarousel.getElementPageNumber(blueprintElem);

		this.xscarousel.slideToPage(pageNumber);
		this.setBlueprintSetHighlighted(productKey);
	};

	this.findBlueprintSetByProductKey = function(productKey) {
		return this.xscarousel.container.find('.admiralBlueprintItem.' + productKey);
	};

	this.setBlueprintSetAssembled = function(productKey) {
		var blueprintSetData = this.blueprintsSetsList[productKey];

		blueprintSetData.is_assembled = true;

		this._pushBlueprintSetStateChangeAssembled(productKey);
		this._onBlueprintsSetsStateUpdate();
	};

	this.setBlueprintSetHighlighted = function(productKeyToHighlight) {

		for (var productKey in this.blueprintsSetsList) {
			var blueprintSetData = this.blueprintsSetsList[productKey];

			if (productKey === productKeyToHighlight) {
				blueprintSetData.is_highlighted = true;
			} else {
				blueprintSetData.is_highlighted = false;
			}
		}

		this._onBlueprintsSetsStateUpdate();
	};

	this.addSegmentToBlueprintSet = function(productKey, index, count) {
		var blueprintSetData = this.blueprintsSetsList[productKey];

		blueprintSetData.segments_map[index] += count;

		this._onBlueprintsSetsStateUpdate();
	};

	this.updateSegmentsMapInBlueprintSet = function(productKey, segmentsMap) {
		var blueprintSetData = this.blueprintsSetsList[productKey];

		blueprintSetData.segments_map = segmentsMap;

		this._onBlueprintsSetsStateUpdate();
	};

	this._pushBlueprintSetStateChangeAssembled = function(productKey) {
		$.post('ajax_admiral_blueprints.php?uid=' + (new Date()).valueOf(), {
			type: 'setBlueprintSetStateChangeAssembled',
			productKey: productKey
		}, function(response) {
			if (response.status === false) {
				showDialogMessagePopup(response.message, function() {
					_this._load();
				});
			}
		}, 'json');
	};

	this._load = function() {
		this._renderCarouselLoading();

		$.post('ajax_admiral_blueprints.php?uid=' + (new Date()).valueOf(), {
			type: 'getBlueprintsSetsList'
		}, function(response) {
			_this.blueprintsSetsList = response;
			_this._onBlueprintsSetsListUpdate();
		}, 'json');
	};

	this._onBlueprintsSetsListUpdate = function() {
		for (var i = 0; i < this.onBlueprintsSetsListUpdateCallbacks.length; i++) {
			this.onBlueprintsSetsListUpdateCallbacks[i]();
		}
	};

	this._onBlueprintsSetsStateUpdate = function() {
		for (var i = 0; i < this.onBlueprintsSetsStateUpdateCallbacks.length; i++) {
			this.onBlueprintsSetsStateUpdateCallbacks[i]();
		}
	};

	this._onBlueprintSetClick = function(blueprintSetElem) {
		for (var i = 0; i < this.onBlueprintsSetsClickCallbacks.length; i++) {
			this.onBlueprintsSetsClickCallbacks[i](blueprintSetElem);
		}
	};

	this._renderCarouselLoading = function() {
		this.xscarousel.container.html(
				$('<div />')
				.css('width', this.xscarousel.container.parent().css('width'))
				.css('height', this.xscarousel.container.parent().css('height'))
				.append($('<div class="loadingAnimation" style="margin: 40px auto;" />')));
	};

	this._renderCarousel = function() {
		this.xscarousel.container.html('');

		var blueprintsSetsSortedList = this.getBlueprintsSetsSortedList();
		for (var i in blueprintsSetsSortedList) {
			var blueprintSetData = blueprintsSetsSortedList[i];

			this.xscarousel.container.append(this.generateBlueprintSetElem(blueprintSetData));
		}
	};

	this._evalBlueprintSets = function() {
		for (var productKey in this.blueprintsSetsList) {
			var blueprintSetData = this.blueprintsSetsList[productKey];
			var blueprintSetElem = this.findBlueprintSetByProductKey(blueprintSetData.product_key);

			var blueprintSetProgressPercent = Math.round((this._getNonEmptySegmentsCount(blueprintSetData.product_key) / 9) * 100);

			if (blueprintSetData.is_assembled) {
				blueprintSetElem.addClass('assembled');
			} else {
				blueprintSetElem.removeClass('assembled');
			}

			if (blueprintSetData.is_highlighted) {
				blueprintSetElem.addClass('highlight');
			} else {
				blueprintSetElem.removeClass('highlight');
			}

			blueprintSetElem.find('.progress .bar .scale')
					.stop(true, true)
					.animate({'width': blueprintSetProgressPercent + '%'});
		}
	};

	this._addBlueprintSetEventListeners = function() {
		xscarousel.container.find('.admiralBlueprintItem .preview').bind('mouseover', function() {
			var blueprintSetData = $(this).parent().data('info');
			Tip(blueprintSetData.name_translated);
		});

		xscarousel.container.find('.admiralBlueprintItem .progress .bar').bind('mouseover', function() {
			var blueprintSetData = $(this).parent().parent().data('info');
			Tip(_this.getTranslation('BLUEPRINT_SET_SEGMENTS_COLLECTED') + ': ' + (_this._getNonEmptySegmentsCount(blueprintSetData.product_key)) + '/9');
		});

		xscarousel.container.find('.admiralBlueprintItem .progress .assembledBtn').bind('mouseover', function() {
			Tip(_this.getTranslation('BLUEPRINT_SET_ASSEMBLED'));
		});

		xscarousel.container.find('.admiralBlueprintItem .preview, .admiralBlueprintItem .progress .bar, .admiralBlueprintItem .progress .assembledBtn').bind('mouseout', function() {
			UnTip();
		});

		xscarousel.container.find('.admiralBlueprintItem').bind('click', function() {
			_this._onBlueprintSetClick($(this));
		});
	};

	this._getNonEmptySegmentsCount = function(productKey) {
		var blueprintSetData = this.blueprintsSetsList[productKey];

		var count = 0;
		for (var i = 0; i < blueprintSetData.segments_map.length; i++) {
			if (blueprintSetData.segments_map[i] > 0) {
				count++;
			}
		}

		return count;
	};

	this.getBlueprintsSetsSortedList = function() {
		var list = [];
		for (var productKey in this.blueprintsSetsList) {
			list.push(this.blueprintsSetsList[productKey]);
		}

		list.sort(firstBy(function(v1, v2) {
			return v1.is_assembled - v2.is_assembled;
		}).thenBy(function(v1, v2) {
			return v1.category_priority - v2.category_priority;
		}).thenBy(function(v1, v2) {
			return _this._getNonEmptySegmentsCount(v2.product_key) - _this._getNonEmptySegmentsCount(v1.product_key);
		}).thenBy(function(v1, v2) {
			return v1.priority - v2.priority;
		}));

		return list;
	};
}