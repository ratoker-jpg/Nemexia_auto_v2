function AdmiralElements(premiumPopup) {
	var _this = this;
	var _subDisplayContainer;

	this.init = function() {
		_subDisplayContainer = $('.premiumSubDisplay.admiralElements');
		this._initEvents();
	};

	this.refresh = function() {
		premiumPopup.displayMethod('subtabAdmiralElementsPurchase', 'refreshDisplay', {}, function() {
			_this.init();
		});
	};

	this._initEvents = function() {
		_subDisplayContainer.find('.admiralElementsPackage input[type="button"]').click(function() {
			var btnClicked = $(this);
			var elementsPackageId = btnClicked.attr('data-package-id');
			var currency = btnClicked.attr('data-currency');

			if (btnClicked.hasClass('inactive')) {
				return;
			}

			showConfirm(premiumPopup.getTranslation('ELEMENTS_PACKAGE_CONFIRM_BUY'), function() {
				btnClicked.addClass('inactive');

				premiumPopup.applyMethod(
					'subtabAdmiralElementsPurchase',
					'buyPackage',
					{
						elementsPackageId: elementsPackageId,
						currencyType: currency
					},
					{
						onresponse: function() {
							btnClicked.removeClass('inactive');
						},
						onsuccess: function(response) {
							if (isset(response.elementsBalance)) {
								_subDisplayContainer.find('.infoBar .elementsDisplay').html(number_format(response.elementsBalance));

								if (typeof updateAdmiralElementsDisplay === 'function') {
									updateAdmiralElementsDisplay(response.elementsBalance);
								}

								if (typeof admiralCraftManager !== 'undefined') {
									admiralCraftManager.update();
								}
							}
							refreshSession('session');
							premiumPopup.fireEvent('admiralElementsPurchase');
						}
					});
			});
		});
	};

	this.init();
	premiumPopup.addListener('admiralElementsBalanceAltered', _this.refresh);
}

if (window.dependencyResolver) {
	window.dependencyResolver.markAsLoaded('AdmiralElements');
}