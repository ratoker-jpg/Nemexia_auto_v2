function ajaxtabs(buttonsContainer, displayContainer, url) {
	
	var _this = this;
	var _tabs = {};
	var _selectedId = undefined;	// Silence Eclipse warnings
	
	function _onButtonClick() {
		var tabId = $(this).attr('data-tabs-id');
		if (_selectedId != tabId){
			_this.showTab(tabId);
		}
	}
	
	this.loadDisplay = function(tabId, showDisplay, params) {
		if (_tabs[tabId].loading) {
			return;
		}
		_tabs[tabId].loading = true;
		params = params || {};
		params.tabId = tabId;
		$.get(url, params, function(data) {
			_tabs[tabId].element = $('<div></div>');
			$(displayContainer).append(_tabs[tabId].element);
			$(_tabs[tabId].element).hide();
			$(_tabs[tabId].element).html(data);
			_tabs[tabId].loading = false;
			if (showDisplay) {
				_this.showTab(tabId);
			}
		});
	};
	
	this.showTab = function(tabId) {
		if (_tabs[tabId].element == undefined) {
			_this.loadDisplay(tabId, true);
			return;
		}
		if (typeof _tabs[_selectedId].onhide == 'function') {
			_tabs[_selectedId].onhide();
		}
		
		$(buttonsContainer).find('[data-tabs-id="' + _selectedId + '"]').removeClass('selected');
		$(buttonsContainer).find('[data-tabs-id="' + _selectedId + '"]').removeAttr('data-tabs-selected');
		if (_selectedId != tabId) {
			$(_tabs[_selectedId].element).hide();
		}
		$(_tabs[tabId].element).show();
		$(buttonsContainer).find('[data-tabs-id="' + tabId + '"]').addClass('selected');
		$(buttonsContainer).find('[data-tabs-id="' + tabId + '"]').attr('data-tabs-selected', 'true');
		_selectedId = tabId;
		
		if (typeof _tabs[tabId].onshow == 'function') {
			_tabs[tabId].onshow();
		}
	};
	
	this.reattachHandlers = function() {
		$(buttonsContainer).find('[data-tabs-type="tabsButton"]').click(_onButtonClick);
	};
	
	this.init = function(useLoadedDisplay) {
		var firstTabId = undefined;	// Silence Eclipse warnings;
		
		$(buttonsContainer).find('[data-tabs-type="tabsButton"]').each(function (index) {
			var tabId = $(this).attr('data-tabs-id');
			if ($(this).attr('data-tabs-selected')) {
				_selectedId = tabId;
			} else if (index == 0) {
				firstTabId = tabId;
			}
			$(this).click(_onButtonClick);
			if (_tabs[tabId] == undefined) {
				_tabs[tabId] = {
					loading: false
				};
			}
		});
		
		if (_selectedId == undefined) {
			_selectedId = firstTabId;
		}
		
		if (useLoadedDisplay) {
			_tabs[_selectedId].element = $(displayContainer).find(':first-child').first();
		} else {
			_this.loadDisplay(_selectedId, true);
		}
	};
	
	this.addListener = function(tabId, event, callback) {
		if (_tabs[tabId] == undefined) {
			_tabs[tabId] = {};
		}
		if (typeof callback != 'function') {
			throw new "callback must be a function";
		}
		_tabs[tabId][event] = callback;
	};
	
	this.getTabIds = function() {
		var tabIds = [];
		for (var x in _tabs) {
			tabIds.push(x);
		}
		return tabIds;
	};
	
	this.getSelectedId = function() {
		return _selectedId;
	};
	
	this.getTabDisplayElement = function(tabId) {
		return _tabs[tabId].element;
	};
	
}

if (window.dependencyResolver) {
	window.dependencyResolver.markAsLoaded('ajaxtabs');
}