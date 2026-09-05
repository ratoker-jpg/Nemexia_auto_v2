function AdmiralInventory(xscarousel, itemsCounterSelector) {
	var _this = this;

	this.xscarousel = xscarousel;
	this.itemsCounter = $(itemsCounterSelector);
	this.translations = {};
	this.itemsList = [];
	this.onItemsListUpdateCallbacks = [];
	this.onItemsStateUpdateCallbacks = [];
	this.onItemClickCallbacks = [];

	this.init = function() {
		this.addOnItemsListUpdateCallback(function() {
			_this._renderCarousel();
			_this._renderCounter();
			_this._evalItems();
			_this._addItemsEventListeners();
		});

		this.addOnItemsStateUpdateCallback(function() {
			_this._evalItems();
		});

		this._addEventListeners();
		this._load();
	};

	this.addItem = function(itemData) {
		this.itemsList.push(itemData);
		this._onItemsListUpdate();
	};

	this.removeItems = function(itemsList) {
		var i = this.itemsList.length;
		while (i--) {
			var itemData = this.itemsList[i];

			if (jQuery.inArray(itemData.id, itemsList) < 0) {
				continue;
			}

			this.itemsList.splice(i, 1);
		}

		this._onItemsListUpdate();
	};

	this.findItemById = function(itemId) {
		return this.xscarousel.container.find('.admiralEquipmentItem[data-item-id=' + itemId + ']');
	};

	this.addOnItemsListUpdateCallback = function(callback) {
		this.onItemsListUpdateCallbacks.unshift(callback);
	};

	this.addOnItemsStateUpdateCallback = function(callback) {
		this.onItemsStateUpdateCallbacks.unshift(callback);
	};

	this.addOnItemClickCallback = function(callback) {
		this.onItemClickCallbacks.unshift(callback);
	};

	this.addTranslation = function(tag, value) {
		this.translations[tag] = value;
	};

	this.getTranslation = function(tag) {
		return this.translations[tag];
	};

	this.getIsFull = function() {
		return this.itemsList.length >= parseInt(this.itemsCounter.attr('data-max'));
	};

	this.generateItemElem = function(itemData, hintText) {
		return $('<div class="admiralEquipmentItem"/>')
				.append($('<div class="hallmark"/>'))
				.addClass(itemData.type)
				.addClass(itemData.level)
				.addClass(itemData.primary_bonus)
				.attr('data-item-id', itemData.id)
				.attr('data-hint-text', hintText)
				.data('info', itemData);
	};

	this.generateItemTooltipElem = function(itemElem) {
		var itemData = itemElem.data('info');

		var bonusesList = $('<ul />').addClass('admiralEquipmentItemBonusList');
		for (var i in itemData.bonuses) {
			var bonus = $('<li />')
					.addClass(itemData.bonuses[i].type)
					.html(itemData.bonuses[i].name_translated + ': ' + itemData.bonuses[i].value.toFixed(2) + '%');

			bonusesList.append(bonus);
		}

		var tooltipElem = $('<div />')
				.addClass('admiralEquipmentTooltip')
				.append($('<div />').addClass('titleBox').html(itemElem.data('info').name_translated))
				.append(bonusesList);

		if (itemElem.hasClass('inactive')) {
			tooltipElem.append($('<div />').addClass('reasonBox').html(itemElem.data('info').inactive_reason));
		} else {
			tooltipElem.append($('<div />').addClass('hintBox').html(itemElem.attr('data-hint-text')));
		}

		return tooltipElem;
	};

	this.highlightItem = function(itemId) {
		var itemElem = this.findItemById(itemId);
		var pageNumber = this.xscarousel.getElementPageNumber(itemElem.parent());

		this.xscarousel.slideToPage(pageNumber);
		itemElem.hide().show('drop', {direction: 'up'}, 750);
	};

	this.setItemsEquipped = function(changesList) {
		for (var i = 0; i < changesList.length; i++) {
			var changeData = changesList[i];

			var itemElem = this.findItemById(changeData.itemId);
			var itemData = itemElem.data('info');

			itemData.is_equipped = changeData.state;
			itemData.in_use = changeData.state;
		}

		this._pushItemsStateChangeEquipped(changesList);
		this._onItemsStateUpdate();
	};

	this.setItemsForbiddenByLevel = function(levelsList, state, muteStatusUpdate) {
		for (var i in this.itemsList) {
			var itemData = this.itemsList[i];

			if (jQuery.inArray(itemData.level, levelsList) < 0) {
				continue;
			}

			itemData.forbidden_level = state;
		}

		if (!muteStatusUpdate) {
			this._onItemsStateUpdate();
		}
	};

	this.setItemInUse = function(itemId, state) {
		var itemElem = this.findItemById(itemId);
		var itemData = itemElem.data('info');

		itemData.in_use = state;

		this._onItemsStateUpdate();
	};

	this._addEventListeners = function() {
		this.itemsCounter.bind('mouseover', function() {
			if ($(this).hasClass('overflow')) {
				Tip(_this.getTranslation('ITEMS_COUNT_MAX_LIMIT_REACHED'));
			}
		});

		this.itemsCounter.bind('mouseout', function() {
			UnTip();
		});
	};

	this._addItemsEventListeners = function() {
		xscarousel.container.find('.admiralEquipmentItem').bind('mouseover', function() {
			var tooltipElem = _this.generateItemTooltipElem($(this));
			Tip($("<div />").append(tooltipElem).clone().html());
		});

		xscarousel.container.find('.admiralEquipmentItem').bind('mouseout', function() {
			UnTip();
		});

		xscarousel.container.find('.admiralEquipmentItem').bind('click', function() {
			_this._onItemClick($(this));
		});
	};

	this._onItemsListUpdate = function() {
		this.itemsList.sort(firstBy(function(v1, v2) {
			return v2.level_priority - v1.level_priority;
		}).thenBy(function(v1, v2) {
			return v2.id - v1.id;
		}));

		for (var i = 0; i < this.onItemsListUpdateCallbacks.length; i++) {
			this.onItemsListUpdateCallbacks[i]();
		}
	};

	this._onItemsStateUpdate = function() {
		for (var i = 0; i < this.onItemsStateUpdateCallbacks.length; i++) {
			this.onItemsStateUpdateCallbacks[i]();
		}
	};

	this._onItemClick = function(itemElem) {
		for (var i = 0; i < this.onItemClickCallbacks.length; i++) {
			this.onItemClickCallbacks[i](itemElem);
		}
	};

	this._setItemInactive = function(itemElem, reason) {
		itemElem.addClass('inactive');
		itemElem.data('info').inactive_reason = reason;
	};

	this._setItemActive = function(itemElem) {
		itemElem.removeClass('inactive');
		delete itemElem.data('info').inactive_reason;
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

		var index = 0;
		for (var i in this.itemsList) {
			var itemData = this.itemsList[i];

			if (index++ % 2 === 0) {
				this.xscarousel.container.append($('<div class="column" />'));
			}

			this.xscarousel.container.find('.column').last().append(this.generateItemElem(itemData, this.getTranslation('ITEM_ACTIVE_CLICK_TO_USE')));
		}
	};

	this._renderCounter = function() {
		var countCurrent = this.itemsList.length;
		var countMax = parseInt(this.itemsCounter.attr('data-max'));

		this.itemsCounter.find('.current').html(countCurrent);
		this.itemsCounter.find('.max').html(countMax);

		if (countCurrent >= countMax) {
			this.itemsCounter.addClass('overflow');
		} else {
			this.itemsCounter.removeClass('overflow');
		}
	};

	this._evalItems = function() {
		for (var i in this.itemsList) {
			var itemData = this.itemsList[i];
			var itemElem = this.findItemById(itemData.id);

			if (itemData.is_equipped) {
				this._setItemInactive(itemElem, this.getTranslation('ITEM_INACTIVE_REASON_IS_EQUIPPED'));
				continue;
			}

			if (itemData.in_use) {
				this._setItemInactive(itemElem, this.getTranslation('ITEM_INACTIVE_REASON_IN_USE'));
				continue;
			}

			if (itemData.forbidden_level) {
				this._setItemInactive(itemElem, this.getTranslation('ITEM_INACTIVE_REASON_FORBIDDEN_ITEM_LEVEL'));
				continue;
			}

			if (itemElem.hasClass('inactive')) {
				this._setItemActive(itemElem);
			}
		}
	};

	this._pushItemsStateChangeEquipped = function(changesList) {
		$.post('ajax_admiral_equipment.php?uid=' + (new Date()).valueOf(), {
			type: 'setItemsStateChangeEquipped',
			changesList: changesList
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

		$.post('ajax_admiral_equipment.php?uid=' + (new Date()).valueOf(), {
			type: 'getItemsList'
		}, function(response) {
			_this.itemsList = response;
			_this._onItemsListUpdate();
		}, 'json');
	};
}