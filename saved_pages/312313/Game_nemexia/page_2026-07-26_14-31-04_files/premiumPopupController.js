function PremiumPopupController(popupContainer, tabsMap) {
	
	var _url = 'ajax_premium.php?method=showTab';
	
	var _popupCloseButton = '#premiumPopupCloseBtn';
	
	var _rootTabButtonsContainer = '#mainTabsContainer';
	var _rootTabDisplayContainer = '#premiumMainDisplay';
	
	var _popupCreditsContainer = '#premiumCreditsContainer';
	var _popupStarsContainer = '#premiumStarsContainer';
	var _popupStoredServicesContainer = '#premiumStoredServicesContainer';
	var _popupBuyCreditsBtn = '#premiumBuyCreditsBtn';
	
	var _popupShortcutPlatinum = '.goto.platinum';
	
	var _globalCreditsContainer = '#creditsHolder';
	var _globalStarsContainer  = '#starsHolder';
	
	var _blackOverlay = '.black_overlay';
	
	var _rootTabIds;
	var _rootTabController;
	var _subTabControllers = {};
	
	var _translations = {};
	
	var _eventHandlers = {};
	
	var _this = this;
	
	this.applyMethod = function(tabId, method, params, onresponse, onsuccess, onfail, onrefresh) {
		var url = 'ajax_premium.php?method=applyMethod';
		if (!params) {
			params = {};
		}
		
		if (typeof onresponse == 'object') {
			if (typeof onresponse.onsuccess == 'function') {
				onsuccess = onresponse.onsuccess;
			}
			if (typeof onresponse.onfail == 'function') {
				onfail = onresponse.onfail;
			}
			if (typeof onresponse.onrefresh == 'function') {
				onrefresh = onresponse.onrefresh;
			}
			if (typeof onresponse.onresponse == 'function') {
				onresponse = onresponse.onresponse;
			}
		}
		
		params.tabId = tabId;
		params.modelMethod = method;
		$.post(url, params, function(result) {
			
			updateValueAnimated($(_popupCreditsContainer), number_format(result.credits));
			$(_globalCreditsContainer).html(number_format(result.credits));
			updateValueAnimated($(_popupStarsContainer), number_format(result.stars));
			$(_globalStarsContainer).html(number_format(result.stars));
			
			var amountSum = 0;
			for (var i in result.storedServicesList) {
				$(_popupStoredServicesContainer).find('ul li.' + i + ' span.amount').html(result.storedServicesList[i]);
				amountSum += result.storedServicesList[i];
			}
			
			updateValueAnimated($(_popupStoredServicesContainer).find('span.amountSum'), number_format(amountSum));

			if (result.msg) {
				if (!result.success) {
					showDialogMessagePopup(result.msg);
				} else {
					showDialogMessage(result.msg);
				}
			}
			
			if (typeof onresponse == 'function') {
				onresponse(result);
			}
			if (typeof onsuccess == 'function' && result.success) {
				onsuccess(result);
			} else if (typeof onfail == 'function' && !result.success) {
				onfail(result);
			}
			if (result.display) {
				_this.getSubTabController(tabId).getTabDisplayElement(tabId).html(result.display);
				if (typeof onrefresh == 'function') {
					onrefresh(result);
				}
			}
		}, 'json');
	};
	
	this.displayMethod = function(tabId, method, params, onresponse) {
		var url = 'ajax_premium.php?method=displayMethod';
		if (!params) {
			params = {};
		}
		
		params.tabId = tabId;
		params.displayMethod = method;
		$(_this.getSubTabController(tabId).getTabDisplayElement(tabId)).load(url, params, onresponse);
	};
	
	this.showTab = function(tabId) {
		// First check if it's a root tab
		var rootTabIds = _rootTabController.getTabIds();
		if (rootTabIds.indexOf(tabId) != -1) {
			_rootTabController.showTab(tabId);
			return true;
		}
		
		// It's not a root tab so find the root tab using the tabs map
		for (var i = 0; i < rootTabIds.length; i++) {
			if (tabsMap[rootTabIds[i]].indexOf(tabId) != -1) {
				// Found the root tab containing the subtab
				// Check if the subtab controller has been loaded
				if (_subTabControllers[rootTabIds[i]] != undefined) {
					// Loaded. Show both the root tab and the sub tab
					_rootTabController.showTab(rootTabIds[i]);
					_subTabControllers[rootTabIds[i]].showTab(tabId);
					return true;
				}
				// Not loaded. Load and show
				_rootTabController.loadDisplay(rootTabIds[i], true, {subTabId: tabId});
				return true;
			}
		}
		
		throw 'Unexisting tabId';
	};
	
	this.addTranslation = function(tag, value) {
		_translations[tag] = value;
	};
	
	this.getTranslation = function(tag) {
		return _translations[tag];
	};
	
	this.addListener = function(eventName, callback) {
		if (typeof callback != 'function') {
			throw 'Callback must be a function';
		}
		if (_eventHandlers[eventName] == undefined) {
			_eventHandlers[eventName] = [];
		}
		_eventHandlers[eventName].push(callback);
	};
	
	this.fireEvent = function(eventName) {
		if (_eventHandlers[eventName] == undefined) {
			return;
		}
		for (var i = 0; i < _eventHandlers[eventName].length; i++) {
			_eventHandlers[eventName][i]();
		}
	};
	
	this.show = function() {
		$(popupContainer).css('top', Math.abs($(window).scrollTop()) + 20);
		$(popupContainer).fadeIn();
		$(_blackOverlay).bind('click', function(){_this.hide();}).show();
	};
	
	this.hide = function() {
		$(popupContainer).fadeOut();
		$(_blackOverlay).unbind('click').hide();
	};
	
	this.getSubTabController = function(tabId) {
		var rootTabIds = _rootTabController.getTabIds();
		for (var i = 0; i < rootTabIds.length; i++) {
			if (_subTabControllers[rootTabIds[i]] != undefined) {
				var subTabIds = _subTabControllers[rootTabIds[i]].getTabIds();
				if (subTabIds.indexOf(tabId) != -1) {
					return _subTabControllers[rootTabIds[i]];
				}
			}
		}
	};
	
	function _init() {
		// Create the root tab control
		_rootTabController = new ajaxtabs(_rootTabButtonsContainer, _rootTabDisplayContainer, _url);
		_rootTabController.init(true);
		
		// Create first sub tab control
		var selectedSubTab = _rootTabController.getSelectedId();
		_subTabControllers[selectedSubTab] = new ajaxtabs(
				$('[data-premium-type="subTabsContainer"][data-premium-tabId="' + selectedSubTab + '"]'),
				$('[data-premium-type="subTabsDisplay"][data-premium-tabId="' + selectedSubTab + '"]'),
				_url
			);
		_subTabControllers[selectedSubTab].init(true);
		
		
		// Attach onshow event listeners to the root tab control
		_rootTabIds = _rootTabController.getTabIds();
		for (var i = 0; i < _rootTabIds.length; i++) {
			_rootTabController.addListener(_rootTabIds[i], 'onshow', (function(tabId) {
					return function () {
						if (_subTabControllers[tabId] == undefined) {
							_subTabControllers[tabId] = new ajaxtabs(
								$('[data-premium-type="subTabsContainer"][data-premium-tabId="' + tabId + '"]'),
								$('[data-premium-type="subTabsDisplay"][data-premium-tabId="' + tabId + '"]'),
								_url
							);
							_subTabControllers[tabId].init(true);
						}
					};
			}(_rootTabIds[i])));
		}
		
		// Attach handler to close button
		$(_popupCloseButton).click(function() {
			_this.hide();
		});
		
		$(_popupCreditsContainer + ', ' + _popupBuyCreditsBtn).click(function() {
			_this.hide();
			paymentsOpen();
		});
		
		$(_popupStarsContainer + ', ' + _popupShortcutPlatinum).click(function() {
			_this.hide();
			openPlatinumPopup();
		});

		$(_popupStoredServicesContainer).click(function() {
			openPremiumPopup('subtabCapsulesPackages');
		}).bind('mouseover', function(){
			Tip($("<div />").append($(this).find('div.storedServicesTooltip').clone()).html());
		}).bind('mouseout', function(){
			UnTip();
		});
		
		$(_rootTabButtonsContainer).find('a.mainTab div.promo').bind('mouseover', function(){
			Tip(_this.getTranslation('TAB_CONTAINS_PROMO_SERVICES'));
		}).bind('mouseout', function(){
			UnTip();
		});
	}
	
	_init();
}

if (window.dependencyResolver) {
	window.dependencyResolver.markAsLoaded('PremiumPopupController');
}
