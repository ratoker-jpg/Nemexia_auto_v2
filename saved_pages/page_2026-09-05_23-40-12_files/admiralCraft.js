function AdmiralCraftManager(levelsList, inputForSameLevel, inputForNextLevel, transformerDisplaySelector, elementsDisplaySelector) {
	var _this = this;

	this.inventory = false;
	this.levelsList = levelsList;
	this.inputForSameLevel = inputForSameLevel;
	this.inputForNextLevel = inputForNextLevel;
	this.transformerDisplay = $(transformerDisplaySelector);
	this.elementsDisplay = $(elementsDisplaySelector);
	this.transformBtn = this.transformerDisplay.find('.actionsBar .transformItems input');
	this.generateBtn = this.transformerDisplay.find('.actionsBar .generateItems input');

	this.init = function(admiralInventory) {
		this.inventory = admiralInventory;

		this._addInventoryEventListeners();
		this._addGenerateBtnEventListeners();
		this._addTransformBtnEventListeners();
	};

	this.update = function() {
		this._clearInputItems();
		this._renderInputItems();
		this._renderInputSlots();
		this._renderProductSlot();
		this._renderTransformBtn();
		this._renderGenerateBtn();
		this._addItemsEventListeners();
	};

	this._addItemsEventListeners = function() {
		this.transformerDisplay.find('.inputItems .admiralEquipmentItem').not('.inputSlot').bind('mouseover', function() {
			var tooltipElem = _this.inventory.generateItemTooltipElem($(this));
			Tip($("<div />").append(tooltipElem).clone().html());
		});

		this.transformerDisplay.find('.inputItems .admiralEquipmentItem').not('.inputSlot').bind('mouseout', function() {
			UnTip();
		});

		this.transformerDisplay.find('.inputItems .admiralEquipmentItem').not('.inputSlot').bind('click', function() {
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

	this._addGenerateBtnEventListeners = function() {
		this.generateBtn.bind('click', function() {
			if (_this.generateBtn.hasClass('inactive')) {
				return;
			}

			_this._handleGenerateBtnClick();
		});
	};

	this._addTransformBtnEventListeners = function() {
		this.transformBtn.bind('click', function() {
			if (_this.transformBtn.hasClass('inactive')) {
				return;
			}

			_this._handleTransformBtnClick();
		});
	};

	this._handleItemClick = function(itemElem) {
		UnTip();

		var itemData = itemElem.data('info');

		if (!itemData) {
			return;
		}

		// Shift up consecutive items
		for (var i in this.inventory.itemsList) {
			var itemShiftData = this.inventory.itemsList[i];
			if (itemShiftData.transformerSlotPosition > itemData.transformerSlotPosition) {
				itemShiftData.transformerSlotPosition--;
			}
		}

		if (this._getInputItemsCount() === 1) {
			this._setInventoryItemsNotForbiddenByLevel();
		}

		delete itemData.transformerSlotPosition;
		this.inventory.setItemInUse(itemData.id, false);
	};

	this._handleItemClickInventory = function(itemElem) {
		// Ignore click on inactive items
		if (itemElem.hasClass('inactive')) {
			return;
		}

		var itemData = itemElem.data('info');
		if (this._getInputItemsCount() >= this.inputForNextLevel) {
			return;
		}

		if (this._getInputItemsCount() === this.inputForSameLevel && this.levelsList[this._getInputItemsLevel()].upgradesTo === false) {
			return;
		}

		if (this._getInputItemsCount() === 0) {
			this._setInventoryItemsForbiddenByLevelExcept(itemData.level);
		}

		itemData.transformerSlotPosition = this._getInputItemsCount() + 1;
		this.inventory.setItemInUse(itemData.id, true);

		// Force tooltip update
		itemElem.trigger('mouseover');
	};

	this._handleGenerateBtnClick = function() {
		this.generateBtn.addClass('inactive');
		$.post('ajax_admiral_equipment.php', {
			type: 'generateItem'
		}, function(response) {
			if (response.status === true) 
			{
				//localStorage.clear();
				try {
				  localStorage.removeItem('expiretime');
				  localStorage.removeItem('positions');
				}
				catch(err) {}
			}
			if (response.status === false) {
				_this.generateBtn.removeClass('inactive');
				showDialogMessagePopup(response.message);
				return;
			}

			firePremiumPopupEvent('admiralElementsBalanceAltered');
			_this._renderElementsDisplay(response.elements_count);
			_this._renderItemBirth(response.itemData, function() {
				_this.inventory.addItem(response.itemData);
				_this.inventory.highlightItem(response.itemData.id);
			});
		}, 'json');
	};

	this._handleTransformBtnClick = function() {
		this.transformBtn.addClass('inactive');

		var removeItemsList = [];
		for (var i in this.inventory.itemsList) {
			var itemData = this.inventory.itemsList[i];

			if (itemData.is_equipped || !itemData.in_use) {
				continue;
			}

			removeItemsList.push(itemData.id);
		}

		$.post('ajax_admiral_equipment.php', {
			itemsList: removeItemsList,
			type: 'transformItems'
		}, function(response) {
			if (response.status === false) {
				_this.transformBtn.removeClass('inactive');
				showDialogMessagePopup(response.message);
				return;
			}

			firePremiumPopupEvent('admiralElementsBalanceAltered');
			_this._renderElementsDisplay(response.elements_count);
			_this.inventory.removeItems(removeItemsList);
			_this._renderItemBirth(response.itemData, function() {
				_this._setInventoryItemsNotForbiddenByLevel();
				_this.inventory.addItem(response.itemData);
				_this.inventory.highlightItem(response.itemData.id);
			});
		}, 'json');
	};

	this._clearInputItems = function() {
		this.transformerDisplay.find('.inputItems .admiralEquipmentItem').not('.inputSlot').remove();
	};

	this._renderInputSlots = function() {
		var inputItemsLevel = this._getInputItemsLevel();
		for (var i = 1; i <= this.inputForNextLevel; i++) {
			var itemElem = this.transformerDisplay.find('.inputItems .admiralEquipmentItem.position_' + i).not('.inputSlot');
			if (itemElem.length <= 0) {
				if (i <= this.inputForSameLevel || (this._getInputItemsCount() >= this.inputForSameLevel && this.levelsList[inputItemsLevel].upgradesTo !== false)) {
					this._renderInputSlotSingle(i, true, true, inputItemsLevel);
				} else {
					this._renderInputSlotSingle(i, true, false, inputItemsLevel);
				}
			} else {
				this._renderInputSlotSingle(i, false, false, inputItemsLevel);
			}
		}
	};

	this._renderInputSlotSingle = function(position, visibilityState, allowed, level) {
		var inputSlot = this.transformerDisplay.find('.inputItems .inputSlot.position_' + position);

		inputSlot.removeClass('allowed').removeClass('forbidden');

		for (var levelClear in this.levelsList) {
			inputSlot.removeClass(levelClear);
		}

		visibilityState ? inputSlot.show() : inputSlot.hide();
		level && allowed ? inputSlot.addClass(level) : false;
		allowed ? inputSlot.addClass('allowed') : inputSlot.addClass('forbidden');
	};

	this._renderInputItems = function() {
		for (var i in this.inventory.itemsList) {
			var itemData = this.inventory.itemsList[i];

			if (itemData.is_equipped || !itemData.in_use) {
				continue;
			}

			var itemElem = this.inventory.generateItemElem(itemData, this.inventory.getTranslation('ITEM_ACTIVE_CLICK_TO_UNUSE'));
			itemElem.addClass('position_' + itemData.transformerSlotPosition);

			this.transformerDisplay.find('.inputItems').append(itemElem);
		}
	};

	this._renderProductSlot = function() {
		var productSlot = this.transformerDisplay.find('.productItem .productSlot');

		var inputItemsLevel = this._getInputItemsLevel();

		for (var levelClear in this.levelsList) {
			productSlot.removeClass(levelClear);
		}

		if (this._getInputItemsCount() === this.inputForSameLevel) {
			productSlot.addClass(inputItemsLevel);
		} else if (this._getInputItemsCount() === this.inputForNextLevel && this.levelsList[inputItemsLevel].upgradesTo !== false) {
			productSlot.addClass(this.levelsList[inputItemsLevel].upgradesTo);
		}
	};

	this._renderTransformBtn = function() {
		if (
				parseInt(this.transformBtn.attr('data-elements-req')) > parseInt(this.elementsDisplay.attr('data-elements-count'))
				|| (this._getInputItemsCount() !== this.inputForSameLevel && this._getInputItemsCount() !== this.inputForNextLevel)
				) {
			this.transformBtn.addClass('inactive');
		} else {
			this.transformBtn.removeClass('inactive');
		}
	};

	this._renderGenerateBtn = function() {
		if (
				this._getInputItemsCount() > 0
				|| this.inventory.getIsFull()
				|| parseInt(this.generateBtn.attr('data-elements-req')) > parseInt(this.elementsDisplay.attr('data-elements-count'))
				) {
			this.generateBtn.addClass('inactive');
		} else {
			this.generateBtn.removeClass('inactive');
		}
	};

	this._renderElementsDisplay = function(count) {
		updateAdmiralElementsDisplay(count);
	};

	this._renderItemBirth = function(itemData, onComplete) {
		var productSlot = this.transformerDisplay.find('.productItem .productSlot');

		productSlot.flip({
			direction: 'tb',
			speed: 150,
			onAnimation: function() {
				productSlot
						.removeClass('empty')
						.addClass(itemData.type)
						.addClass(itemData.level)
						.addClass(itemData.primary_bonus);
			},
			onEnd: function() {
				setTimeout(function() {
					productSlot.hide('drop', {direction: 'down'}, function() {
						productSlot
								.addClass('empty')
								.removeClass(itemData.type)
								.removeClass(itemData.level)
								.removeClass(itemData.primary_bonus)
								.show();

						if (typeof onComplete === 'function') {
							onComplete();
						}
					}, 500);
				}, 500);
			}
		});
	};

	this._setInventoryItemsForbiddenByLevelExcept = function(levelAllowed) {
		var levelsSelectedList = [];
		for (var level in this.levelsList) {
			if (level !== levelAllowed) {
				levelsSelectedList.push(level);
			}
		}

		this.inventory.setItemsForbiddenByLevel(levelsSelectedList, true, true);
	};

	this._setInventoryItemsNotForbiddenByLevel = function() {
		var levelsSelectedList = [];
		for (var level in this.levelsList) {
			levelsSelectedList.push(level);
		}

		this.inventory.setItemsForbiddenByLevel(levelsSelectedList, false, true);
	};

	this._getInputItemsCount = function() {
		return this.transformerDisplay.find('.inputItems .admiralEquipmentItem').not('.inputSlot').length;
	};

	this._getInputItemsLevel = function() {
		var sampleItemElem = this.transformerDisplay.find('.inputItems .admiralEquipmentItem').not('.inputSlot').first();
		if (sampleItemElem.length <= 0) {
			return false;
		}

		return sampleItemElem.data('info').level;
	};
}