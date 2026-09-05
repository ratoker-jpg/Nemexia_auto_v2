ajaxRankingUrl = 'ajax_ranking.php';

function RankingManager() {
	var _this = this;

	this._typeSelectMenu = $('.rankingWrapper .menu.typeSelection');
	this._searchMenu = $('.rankingWrapper .menu.search');
	this._hallOfFameMenu = $('.rankingWrapper .menu.hallOfFame');
	this._infoPanel = $('.rankingWrapper .information');
	this._paginationPanel = $('.rankingWrapper .paginationPanel');
	this._resultsPanel = $('.rankingWrapper .resultsPanel');
	this._tournamentsTypeSelectMenu = $('.rankingWrapper .menu.tournamentsTypeSelection');
	this._tournamentsLeagueSelectMenu = $('.rankingWrapper .menu.tournamentsLeagueSelection');

	this._currentType = null;
	this._currentPage = null;
	this._currentOrderBy = null;
	this._currentSearchCriteria = null;

	this.init = function () {
		this._addEventListeners();
	};

	this.getCurrentType = function () {
		return this._currentType;
	};

	this.getCurrentSearchCriteria = function () {
		return this._currentSearchCriteria;
	};

	this.show = function (type, page, orderBy, searchCriteria, skipIfaceReset) {
		var isTypeChange = false;
		if (type !== null && this._currentType !== type) {
			isTypeChange = true;
		}

		this._currentType = type === null ? this._currentType : type;
		this._currentPage = page === null ? this._currentPage : page;
		this._currentOrderBy = orderBy === null ? this._currentOrderBy : orderBy;
		this._currentSearchCriteria = searchCriteria === null ? this._currentSearchCriteria : searchCriteria;

		if (!skipIfaceReset) {
			this._configureIface(true);
		}

		this._loadRanking();

		if (isTypeChange) {
			this._loadRankingInfo();
		}
	};

	this.showPage = function (page) {
		_this.show(null, page, null, null, true);
	};

	this.orderBy = function (orderBy) {
		if (this._currentOrderBy === orderBy) {
			return;
		}

		_this.show(null, 0, orderBy, null, true);
	};

	this.showRowInfo = function (type, id, parentRowElem) {
		var infoRowElem = null;

		if (parentRowElem.next().hasClass('info')) {
			infoRowElem = parentRowElem.next();
			infoRowElem.remove();

			if (type === infoRowElem.attr('type')) {
				return;
			}
		}

		$.post(ajaxRankingUrl + '?uid=' + (new Date()).valueOf(), {
			type: 'getInfoRow',
			entityType: type,
			entityId: id
		}, function (response) {
			if (response.status !== true) {
				showDialogMessage(response.message);
				return;
			}

			infoRowElem = $('<tr>')
					.append(
							$('<td>')
							.attr('colspan', parentRowElem.find('td').length)
							.html(response.body))
					.addClass('row')
					.addClass('info')
					.attr('type', type)
					.insertAfter(parentRowElem);
		}, 'json');

	};

	this.showRowInfoHOF = function (type, parentRowElem) {
		var infoRowElem = null;

		if (parentRowElem.next().hasClass('info')) {
			infoRowElem = parentRowElem.next();
			infoRowElem.remove();

			if (type === infoRowElem.attr('type')) {
				return;
			}
		}

		var body = '';
		if (type === 'alliance') {
			body = $('<span/>').text(parentRowElem.attr('data-players-csv')).html();
		}

		infoRowElem = $('<tr>')
				.append(
						$('<td>')
						.attr('colspan', parentRowElem.find('td').length)
						.html(body))
				.addClass('row')
				.addClass('info')
				.attr('type', type)
				.insertAfter(parentRowElem);
	};

	this._addEventListeners = function () {
		this._searchMenu.find('input.criteria').bind('keyup', function (e) {
			if (e.keyCode === 13) {
				_this._searchMenu.find('input.search').trigger('click');
			}
		});

		this._searchMenu.find('input.search').bind('click', function () {
			var newSearchCriteria = {text: _this._searchMenu.find('input.criteria').val()};

			if (_this._currentType === 'tournaments') {
				newSearchCriteria.type = _this._currentSearchCriteria.type;
			}

			_this.show(null, 0, null, newSearchCriteria, false);
		});

		this._searchMenu.find('input.gotoSelf').bind('click', function () {
			var newSearchCriteria = {};

			if (_this._currentType === 'tournaments') {
				newSearchCriteria.type = _this._currentSearchCriteria.type;
			}

			_this.show(null, 'goto_self', null, newSearchCriteria, false);
		});

		this._hallOfFameMenu.find('select.round, select.type').bind('change', function () {
			var round = _this._hallOfFameMenu.find('select.round').val();
			var type = _this._hallOfFameMenu.find('select.type').val();

			_this.show(null, null, null, {round: round, type: type}, false);
		});

		this._tournamentsLeagueSelectMenu.find('input').bind('click', function () {
			var btnClicked = $(this);
			var newSearchCriteria = {
				'type': _this._currentSearchCriteria.type
			};

			_this.show(null, btnClicked.attr('data-league-key'), null, newSearchCriteria, false);
		});
	};

	this._configureIface = function (reset) {
		this._typeSelectMenu.find('a').removeClass('selected');
		this._typeSelectMenu.find('a.' + this._currentType).addClass('selected');
		this._typeSelectMenu.show();

		if ($.inArray(this._currentType, ['players', 'alliances', 'tournaments']) >= 0) {
			this._searchMenu.find('input.gotoSelf:not(.' + this._currentType + ')').hide();
			this._searchMenu.find('input.gotoSelf.' + this._currentType).show();
			this._searchMenu.show();
			if (reset) {
				this._searchMenu.find('input.criteria').val(this._currentSearchCriteria.text);
			}
		} else {
			this._searchMenu.hide();
		}

		if (this._currentType === 'hallOfFame') {
			this._hallOfFameMenu.show();
			if (reset) {
				this._hallOfFameMenu.find('select.round').val(this._currentSearchCriteria.round);
				this._hallOfFameMenu.find('select.type').val(this._currentSearchCriteria.type);
			}
		} else {
			this._hallOfFameMenu.hide();
		}

		if (this._currentType === 'tournaments') {
			this._tournamentsTypeSelectMenu.show();
			this._tournamentsLeagueSelectMenu.show();

			this._tournamentsTypeSelectMenu.find('a').removeClass('selected');
			this._tournamentsTypeSelectMenu.find('a.' + this._currentSearchCriteria.type).addClass('selected');
		} else {
			this._tournamentsTypeSelectMenu.hide();
			this._tournamentsLeagueSelectMenu.hide();
		}

		this._paginationPanel.hide();
		this._resultsPanel.html('').hide();
	};

	this._loadRankingInfo = function () {
		this._infoPanel.hide();
		$.post(ajaxRankingUrl + '?uid=' + (new Date()).valueOf(), {
			type: 'getRankingInfo',
			rankingType: this._currentType
		}, function (response) {
			if (response.status !== true) {
				return;
			}

			_this._infoPanel.find('h2').html(response.title);
			_this._infoPanel.find('p').html(response.body);

			_this._infoPanel.show();
		}, 'json');
	};

	this._loadRanking = function () {
		this._resultsPanel.html('').show();

		$.post(ajaxRankingUrl + '?uid=' + (new Date()).valueOf(), {
			type: 'getRanking',
			rankingType: this._currentType,
			page: this._currentPage,
			orderBy: this._currentOrderBy,
			searchCriteria: this._currentSearchCriteria
		}, function (response) {
			if (response.status !== true) {
				showDialogMessage(response.message);
				return;
			}

			if (response.pagination.info) {
				_this._paginationPanel.find('.info').html(response.pagination.info).show();
			} else {
				_this._paginationPanel.find('.info').hide();
			}

			if (response.pagination.controls) {
				_this._paginationPanel.find('.controls').html(response.pagination.controls).show();
			} else {
				_this._paginationPanel.find('.controls').hide();
			}

			_this._paginationPanel.show();

			_this._resultsPanel.html(response.results);
		}, 'json');
	};
}