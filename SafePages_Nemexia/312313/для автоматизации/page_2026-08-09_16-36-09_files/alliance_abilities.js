function AllianceSpecialties() {
	var _translations = {};
	var _displayContainer = $('#allianceSpecialtiesList');
	var _this = this;

	this._init = function() {
		this._initEvents();
		this._initTimers();
	}

	this._initEvents = function () {
		_displayContainer.find('.specialtyItem .upgradeBtn').not('.inactive').bind('click', function() {
			var btnClicked = $(this);
			var specialtyName = btnClicked.parents('.specialtyItem').find('input[name=specialtyName]').val();
			var specialtyNextLevel = btnClicked.parents('.specialtyItem').find('input[name=specialtyLevelNext]').val();

			showConfirm(sprintf(_this.getTranslation('CONFIRM_UPGRADE'), specialtyName, specialtyNextLevel), function() {
				btnClicked.unbind('click');
				_this._upgrade(btnClicked.parents('.specialtyItem').find('input[name=specialtyId]').val());
			});
		});

		_displayContainer.find('.specialtyItem .activateBtn').not('.inactive').bind('click', function() {
			var btnClicked = $(this);
			var specialtyName = btnClicked.parents('.specialtyItem').find('input[name=specialtyName]').val();

			showConfirm(sprintf(_this.getTranslation('CONFIRM_ACTIVATE'), specialtyName), function() {
				btnClicked.unbind('click');
				_this._activate(btnClicked.parents('.specialtyItem').find('input[name=specialtyId]').val());
			});
		});

		_displayContainer.find('.specialtyItem .cooldownDisplay, .specialtyItem .expirationDisplay').bind('mouseover', function(){
			Tip($(this).find('.countdown').attr('data-time-expireDate'));
		}).bind('mouseout', function(){
			UnTip();
		});
	}

	this._initTimers = function () {
		_displayContainer.find('.specialtyItem .cooldownDisplay, .specialtyItem .expirationDisplay').each(function(){
			var displayContainer = $(this);
			var display = displayContainer.find('.countdown');
			var seconds = parseInt(display.attr('data-time-remaining'));

			var interval = setInterval(function() {
				seconds--;
				display.html(SecToTime(seconds));
				if (seconds <= 0) {
					clearInterval(interval);
					displayContainer.slideUp(function(){
						_this._refreshEnvironment();
					});
				}
			}, 1000);
		});
	}

	this._upgrade = function (specialtyId) {
		$.post(ajaxAllianceUrl + ('?uid=' + (new Date()).valueOf()), {
			type: 'abilityUpgrade',
			name: specialtyId
		}, function(response){
			var info = eval('('+ response + ')');

			_this._refreshEnvironment();
			showDialogMessage(info.message);
		});
	}

	this._activate = function (specialtyId) {
		$.post(ajaxAllianceUrl + ('?uid=' + (new Date()).valueOf()), {
			type: 'abilityActivate',
			name: specialtyId
		}, function(response){
			var info = eval('('+ response + ')');

			_this._refreshEnvironment();
			showDialogMessage(info.message);
		});
	}

	this._refreshEnvironment = function() {
		refreshSession('session', function() {
			firePremiumPopupEvent('resourceIncomeChange');
		});
		loadTabContent('allianceSpecialtiesTab');
	}

	this.addTranslation = function(tag, value) {
		_translations[tag] = value;
	};

	this.getTranslation = function(tag) {
		return _translations[tag];
	};

	this._init();

	return true;
}

