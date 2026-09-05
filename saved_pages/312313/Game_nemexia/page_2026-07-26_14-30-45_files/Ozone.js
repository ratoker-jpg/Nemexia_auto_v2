function Ozone(premiumPopup) {
	var _subDisplayContainer = $('.premiumSubDisplay.ozone');

	_subDisplayContainer.find('.ozonePackage input').click(function() {
		var btnClicked = $(this);
		var pid = btnClicked.attr('data-ozone-pid');
		var ozoneDisplay = _subDisplayContainer.find('.ozoneDisplay');

		if (btnClicked.hasClass('inactive')) {
			return;
		}

		showConfirm(
			premiumPopup.getTranslation('OZONE_CONFIRM_BUY'),
			function() {
				btnClicked.addClass('inactive');
				premiumPopup.applyMethod('subtabOzonePurchase', 'buyOzone', {
					packageId: pid
				}, function() {
					btnClicked.removeClass('inactive');
				}, function(response) {
					ozoneDisplay.html(number_format(response.ozone));
					refreshSession('session', function(){
						if (window.location.href.search("ozone_problem.php") > -1) {
							document.location.reload(true);
						}
					});
				});
			});
	});
}

if (window.dependencyResolver) {
	window.dependencyResolver.markAsLoaded('Ozone');
}