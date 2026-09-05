function AdmiralEquipManager(isTeam, characterDisplaySelector, bonusesDisplaySelector) {
	var _this = this;

	this.inventory = false;
	this.isTeam = isTeam;
	this.characterDisplay = $(characterDisplaySelector);
	this.bonusesDisplay = $(bonusesDisplaySelector);

	this.init = function(admiralInventory) {
		this.inventory = admiralInventory;

		this._addInventoryEventListeners();
	};

	this.update = function() {
		this._clearItems();
		this._renderItems();
		this._renderBonusesTotal();
		this._addItemsEventListeners();
	};

	this._addItemsEventListeners = function() {
		this.characterDisplay.find('.admiralEquipmentItem').not('.emptySlot').bind('mouseover', function() {
			var tooltipElem = _this.inventory.generateItemTooltipElem($(this));
			Tip($("<div />").append(tooltipElem).clone().html());
		});

		this.characterDisplay.find('.admiralEquipmentItem').not('.emptySlot').bind('mouseout', function() {
			UnTip();
		});

		this.characterDisplay.find('.admiralEquipmentItem').not('.emptySlot').bind('click', function() {
			_this._handleItemClick($(this));
		});
	};

	this._addInventoryEventListeners = function() {
		this.inventory.addOnItemsListUpdateCallback(function() {
			_this.update();
		});

		this.inventory.addOnItemsStateUpdateCallback(function() {
			_this.update();
		});

		this.inventory.addOnItemClickCallback(function(itemElem) {
			_this._handleItemClickInventory(itemElem);
		});
	};

	this._handleItemClick = function(itemElem) {
		if (this.isTeam) {
			return;
		}

		UnTip();
		var changesList = [{itemId: itemElem.data('info').id, state: false}];
		this.inventory.setItemsEquipped(changesList);
	};

	this._handleItemClickInventory = function(itemElem) {
		// Ignore click on inactive items
		if (itemElem.hasClass('inactive')) {
			return;
		}

		// Changes list - init
		var changesList = [{itemId: itemElem.data('info').id, state: true}];

		// Changes list - add item swaps
		for (var i in this.inventory.itemsList) {
			var itemDataSwap = this.inventory.itemsList[i];

			if (itemDataSwap.is_equipped && itemDataSwap.type === itemElem.data('info').type) {
				changesList.push({itemId: itemDataSwap.id, state: false});
			}
		}

		this.inventory.setItemsEquipped(changesList);

		// Force tooltip update
		itemElem.trigger('mouseover');
	};

	this._clearItems = function() {
		this.characterDisplay.find('.admiralEquipmentItem').not('.emptySlot').each(function() {
			var itemElem = $(this);
			_this._renderEmptySlot(itemElem.data('info').type, true);
			itemElem.remove();
		});
	};

	this._renderItems = function() {
		for (var i in this.inventory.itemsList) {
			var itemData = this.inventory.itemsList[i];

			if (!itemData.is_equipped) {
				continue;
			}

			var itemElem = this.inventory.generateItemElem(itemData, this.inventory.getTranslation('ITEM_ACTIVE_CLICK_TO_UNUSE'));

			this._renderEmptySlot(itemData.type, false);
			this.characterDisplay.find('.items').append(itemElem);
		}
	};

	this._renderEmptySlot = function(itemType, visibilityState) {
		var itemSlotElem = this.characterDisplay.find('.admiralEquipmentItem.emptySlot' + '.' + itemType);

		if (!visibilityState) {
			itemSlotElem.hide();
		} else {
			itemSlotElem.show();
		}
	};

	this._renderBonusesTotal = function() {
		var bonusesTotal = this._calculateBonusesTotal();

		this.bonusesDisplay.find('li').each(function() {
			var bonusElem = $(this);

			var value = 0;
			if (bonusesTotal.hasOwnProperty(bonusElem.attr('data-type'))) {
				value = bonusesTotal[bonusElem.attr('data-type')];
			}

			bonusElem.find('span').html(value.toFixed(2));
		});
	};

	this._calculateBonusesTotal = function() {
		var bonusesTotal = {};
		for (var i in this.inventory.itemsList) {
			var itemData = this.inventory.itemsList[i];

			if (!itemData.is_equipped) {
				continue;
			}

			for (var j in itemData.bonuses) {
				var bonusData = itemData.bonuses[j];
				if (!(bonusData.type in bonusesTotal)) {
					bonusesTotal[bonusData.type] = 0;
				}

				bonusesTotal[bonusData.type] += bonusData.value;
			}
		}

		return bonusesTotal;
	};

}