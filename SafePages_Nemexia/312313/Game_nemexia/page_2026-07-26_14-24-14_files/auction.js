/**
 * A controller object for the auction feature in Nemexia
 * @uses misc.js
 * @uses xsdropdown.js
 */
function AuctionController(translations, turnId, turnTimeLeft, noTurn, displayTab) {
	
	// Save params
	var _translations = translations;
	var _turnId = turnId;
	var _turnTimeLeft = turnTimeLeft;

	// Server url to make AJAX requests to
	var _url = 'ajax_auction.php';
	
	// Find and get some of the basic display elements
	var _auctionTable = $('#auctionTable');	// The table containing  the packages
	var _timerDisplay = $('#auctionTimerDisplay');	// An element to display a timer in
	var _buyoutPopLeftLabel = $('#auctionBuyoutPopLeftLabel'); // A label to show the population left
	var _auctionTabBtn = $('#auctionMenuItemTurns');	// Side menu item turn button
	var _winnersTabBtn = $('#auctionMenuItemWinners');	// Side menu item winners button
	var _winsTabBtn = $('#auctionMenuItemWins');	// Side menu item player's wins button
	
	// Selectors for elements that are initialy loaded
	var _winsHistory = '#TabWonHistoryBox';	// Wins history tab display
	var _showWinsHistoryBtn = '#a_showHistory';	// Wins history tab display show button
	var _hideWinsHistoryBtn = '#a_hideHistory';	// Wins history tab display hide button
	var _noUnusedWinsMsg = '#noUnusedWinsMsg';	// No unused wins message display
	var _winsDisplay =  '#winsDisplay';	// Wins history display
	
	// Id's of the 'major' tabs.
	// No hash sign, because they are used with the showTab() function in misc.js
	var _auctionTabId = 'TabPackages';	// Tab containig the 'main' screen
	var _winnersTabId = 'TabLastTurnWinners';	// Tab containing last winners
	var _winsTabId = 'TabWins';	// Tab containing the player's wins
	
	// Info abaout the packs in the turn.
	// Filled with data from the view
	var _packs = {};
	
	// Double click protection flags
	var _biddingDisabled = false;
	var _buyoutDisabled = false;
	var _useWinDisabled = false;
	
	// Number of timer ticks
	var _timerTicks = 0;
	
	// Display flags
	var _winnersTabLoaded = false;
	var _winsTabLoaded = false;
	var _winsHistoryTabLoaded = false;
	var _winsHistoryTabVisible = false;
	
	/**
	 * Send a request to the server
	 * @param method - The method to be executed
	 * @param params - An object, containing key-value pairs, send as params in the request
	 * @param onsuccess - A function to be executed on success
	 * @param onerror - A function to be executed on error
	 * @param oncomplete - A function to be executed on request completion
	 */
	function _applyMethod(method, params, onsuccess, onerror, oncomplete) {
		// Set required params
		params.method = method;
		params.turnId = turnId;
		$.ajax({
			url: _url,
			type: 'post',
			cache: false,
			dataType: 'json',
			data: params,
			success: function(data) {
				// Server side unhanled error - call onerror
				if (!data) {
					if (typeof onerror == 'function') {
						onerror();
					}
					return;
				}
				if (data.turnInfo) {
					if (data.turnInfo.turnId != _turnId) {	// Turn has expired. Reload with new one
						window.location.reload();
						return;
					}
					_turnTimeLeft = data.turnInfo.timeLeft;	// Syncronize client and server clocks
					_updateTimerDisplay();
				}
				if (data.packagesInfo) {	// Update package table
					_updatePackagesTable(data.packagesInfo);
				}
				if (data.success && typeof onsuccess == 'function') {	// Call onsuccess
					onsuccess(data.result);
				} else if (!data.success) {	// Server side cought exception
					if (data.error) {	// Show error message
						showDialogMessagePopup(data.error);
					}
					if (typeof onerror == 'function') {	// Call onerror
						onerror();
					}
				}
				
			},
			error: function() {
				if (typeof onerror == 'function') {
					error();
				}
			},
			complete: function() {
				if (typeof oncomplete == 'function') {
					oncomplete();
				}
			}
		});
	}
	
	/**
	 * Get an HTML fragment from server and add it to the page
	 * @param method - The method to call on the server
	 * @param displayObject - The element in wich to add the HTML fragment
	 * @param callback - A callback to call on completion
	 */
	function _loadDisplay(method, displayObject, callback) {
		$(displayObject).load(_url, {method: method, turnId: turnId}, callback);
	}
	
	/**
	 * Open the packages tab
	 */
	function _showPackagesTab() {
		showTab(_auctionTabId);
	}
	
	/**
	 * Load, if not loaded, and show the winners tab
	 */
	function _showWinnersTab() {
		if (_winnersTabLoaded) {
			showTab(_winnersTabId);
		} else {
			_loadDisplay('showWinners', $('#' + _winnersTabId), function() {
				_winnersTabLoaded = true;
				showTab(_winnersTabId);
			});
		}
	}
	
	/**
	 * Load, if not loaded, and show the wins tab
	 */
	function _showWinsTab() {
		if (_winsTabLoaded) {
			showTab(_winsTabId);
		} else {
			_loadDisplay('showPlayersUnusedWins', $('#' + _winsTabId), function() {
				// Attach interface interaction callbacks
				_winsTabLoaded = true;
				$('[data-auction2-wins-id]').each(function() {
					var id = $(this).attr('data-auction2-wins-id');
					var select = $(this).find('[data-auction2-wins-planet-select]');
					$(this).find('[data-auction2-wins-use-btn]').click(_useWin(id, select, this));
				}); 
				$(_showWinsHistoryBtn).click(_showWinsHistoryTab);
				$(_hideWinsHistoryBtn).click(_hideWinsHistoryTab);
				showTab(_winsTabId);
			});
		}
	} 
	
	/**
	 * Load, if not loaded, and show the wins history sub-tab
	 */
	function _showWinsHistoryTab() {
		if (_winsHistoryTabLoaded) {
			$(_winsHistory).slideDown(JQ_ANIMATION_SPEED);
			$(_showWinsHistoryBtn).hide();
			$(_hideWinsHistoryBtn).show();
			_winsHistoryTabVisible = true;
		} else {
			_loadDisplay('showPlayersUsedWins', $(_winsHistory), function() {
				_winsHistoryTabLoaded = true;
				_showWinsHistoryTab();
			});
		}
	}
	
	/**
	 * Hide the wins history sub-tab
	 */
	function _hideWinsHistoryTab() {
		$(_winsHistory).slideUp(JQ_ANIMATION_SPEED);
		$(_showWinsHistoryBtn).show();
		$(_hideWinsHistoryBtn).hide();
		_winsHistoryTabVisible = false;
	}
	
	/**
	 * Update the timer's display (you don't say)
	 */
	function _updateTimerDisplay() {
		var m = Math.floor(_turnTimeLeft / 60);
		var s = _turnTimeLeft - m * 60;
		if (m < 10) {
			m = '0' + m;
		}
		if (s < 10) {
			s = '0' + s;
		}
		_timerDisplay.html(m + ':' + s);
	}
	
	/**
	 * Show an appropriate tooltip on hover on disabled buytout button
	 */
	function _tipDisabledBuyout(id) {
		return function() {
			if (_packs[id].buyoutDisabledReason != '') {
				Tip(_packs[id].buyoutDisabledReason);
			}
		};
	}
	
	/**
	 * Show an appropriate tooltip on hover on disabled bid button
	 */
	function _tipDisabledBid(id) {
		return function() {
			if (_packs[id].biddingDisabledReason != '') {
				Tip(_packs[id].biddingDisabledReason);
			}
		};
	}
	
	/**
	 * Hide tooltips
	 */
	function _untip() {
		UnTip();
	}
	
	/**
	 * Show new information in the packages table
	 * @param data - The data with which to update the table
	 */
	function _updatePackagesTable(data) {
		// Traverse the table's row and update with info for tha package
		$(_auctionTable).find('tr[data-auction2-pack-id]').each(function() {
			var id = $(this).attr('data-auction2-pack-id');
			if (data[id] == undefined) {	// No new info for this package
				return;
			}
			
			_packs[id].biddingDisabledReason = data[id].biddingDisabledReason;
			
			// Enable / disable bidding
			if (data[id].biddingDisabledReason != '') {
				$(this).find('input[data-auction2-bid-btn]').addClass('disabled');
				$(this).find('input[data-auction2-bid-value]').prop('disabled', true);
			} else {
				$(this).find('input[data-auction2-bid-btn]').removeClass('disabled');
				$(this).find('input[data-auction2-bid-value]').prop('disabled', false);
			}

			// Show the latest highest bidder
			$(this).find('[data-auction2-highest-bidder]').html(data[id].highestBidder);
		});
	}
	
	/**
	 * Create a function to make a bid
	 * @param id - The id of the package to bid for
	 * @returns {Function} - The actual function to do the bidding
	 */
	function _bid(id) {
		return function() {
			if (_packs[id].biddingDisabledReason != '') {
				return;
			}
			
			var bidValue = parseInt($(_packs[id].element).find('input[data-auction2-bid-value]').val());
			var bidDeltaValue = _packs[id].isPlayerBidding ? bidValue - (_packs[id].minBid - 1) : bidValue;
			var currency = $(_packs[id].element).find('[data-xsdropdown]').xsdropdown('val');
			
			// Check if player has enough resources 
			if (parseInt(PLAYER[currency]) < bidDeltaValue) {
				if (currency != 'recycle') {
					showDialogMessagePopup(_translations.NOT_ENOUGH_RESOURCE);
				} else {
					showDialogMessagePopup(_translations.NOT_ENOUGH_SCRAP);
				}
				return;
			}
			
			// Check if the bid is high enough to be placed
			if (bidValue < _packs[id].minBid) {
				showDialogMessagePopup(_translations.BID_TOO_LOW);
				return;
			}
			
			// Confirm and do the bidding
			_biddingDisabled = true;
			showConfirm(
				_translations.CONFIRM_BID,
				function() {
					// Do bidding
					_applyMethod(
							_packs[id].isPlayerBidding ? 'updateBid' : 'createBid',
							{
								packageId: id,
								currencyType: currency,
								bid: bidValue
							},
							function(data) {
								// Successfuly placed bid
								_packs[id].isPlayerBidding = true;
								_packs[id].minBid = bidValue + 1;
								$(_packs[id].element).addClass('active');
								$(_packs[id].element).find('[data-xsdropdown]').xsdropdown('disabled', true);
								showDialogMessage(data.message);
							},
							null,
							function() {
								refreshSession('planet', function() {
									_biddingDisabled = false;
								});
							}
						);
				},
				function() {
					_biddingDisabled = false;
				}
			);
		};
	}
	
	/**
	 * Create a function to make a buyout
	 * @param id - The id of the package to buyout
	 * @returns {Function} - The actual function to do the buyout
	 */
	function _buyout(id) {
		return function() {
			if (_packs[id].buyoutDisabledReason != '') {
				return;
			}
			
			// Check if player can pay the price
			var price = _packs[id].price;
			if (parseInt(PLAYER.credits) < price) {
				showDialogMessagePopup(_translations.NOT_ENOUGH_CREDITS);
				return;
			}
			
			// Confirm and do the buyout
			_buyoutDisabled = true;
			showConfirm(
				_translations.CONFIRM_BUYOUT,
				function() {
					_applyMethod(
						'buyout',
						{
							packageId: id
						},
						function(data) {
							// Successful buyout
							showDialogMessage(data.message);
							refreshSession('session');
							$(_packs[id].element).find('input[data-auction2-bid-value]').val(data.minBid);
							$(_packs[id].element).find('input[data-auction2-buyout-btn]').addClass('inactive');
							_packs[id].select.xsdropdown('disabled', false);
							$(_packs[id].element).removeClass('active');
							for (var x in _packs) {
								if (data.disabledBuyoutReasons[_packs[x].id]) {
									_packs[x].buyoutDisabledReason = data.disabledBuyoutReasons[_packs[x].id];
								}
							}
							_buyoutPopLeftLabel.html(
								_translations.BUYOUT_POP_LEFT_LABEL.replace(
									'%1$s',
									number_format(parseInt(data.buyoutPopLeft), 0, '.', ',')
								)
							);
							_winsTabLoaded = false; // Force reload of wins
						},
						null,
						function() {
							refreshSession('session', function() {
								_buyoutDisabled = false;
							});
						}
					);
				},
				function() {
					_buyoutDisabled = false;
				}
			);
				
		};
	}
	
	/**
	 * Use a player's win
	 * @param id - The id of the win
	 * @param select - The planet select dropdown from the row in the wins table for this win
	 * @param row - The row for this win in the wins table
	 * @returns {Function} - The actual function to do the use
	 */
	function _useWin(id, select, row) {
		return function() {
			if (_useWinDisabled) {
				return;
			}
			_useWinDisabled = true;
			_applyMethod(
				'useWin', 
				{winId: id, planetId: $(select).val()},
				function(data) {
					// Successful use
					_useWinDisabled = false;
					showDialogMessage(data.message);
					refreshSession('planet');
					if (data.used) {
						$(row).remove();
						var i = 1;
						$('[data-auction2-wins-id]').each(function() {
							$(this).find('td').first().html(i++);
						});
						if (i < 2) {
							$(_winsDisplay).hide();
							$(_noUnusedWinsMsg).show();
						}
						_winsHistoryTabLoaded = false;
						if (_winsHistoryTabVisible) {
							_hideWinsHistoryTab();
							_showWinsHistoryTab();
						}
					}
				},
				null,
				function() {
					_useWinDisabled = false;
				}
			);
		};
	}
	
	// Initialization
	
	// Gather packages information and attach event handlers to interface elements
	if (!noTurn) {
		$(_auctionTable).find('tr[data-auction2-pack-id]').each(function () {
			var info = {
				id: $(this).attr('data-auction2-pack-id'),
				minBid: parseInt($(this).attr('data-auction2-min-bid')),
				price: parseInt($(this).attr('data-auction2-buyout-price')),
				isPlayerBidding: ($(this).attr('data-auction2-player-bidding') == 'true' ? true : false),
				biddingDisabledReason: $(this).attr('data-auction2-bidding-disabled-reason'),
				buyoutDisabledReason: $(this).attr('data-auction2-buyout-disabled-reason'),
				element: this,
				select: $(this).find('[data-xsdropdown]').xsdropdown('init', {
					metal: _translations.RES_METAL,
					crystal: _translations.RES_CRYSTAL,
					gas: _translations.RES_GAS,
					recycle: _translations.RES_SCRAP
				})
			};
			_packs[info.id] = info;
			
			// Attach event handlers to elements from the packages table
			$(this).find('input[data-auction2-bid-btn]').bind('mouseover', _tipDisabledBid(info.id));
			$(this).find('input[data-auction2-bid-btn]').bind('mouseout', _untip);
			$(this).find('input[data-auction2-bid-btn]').bind('click', _bid(info.id));
			
			$(this).find('input[data-auction2-buyout-btn]').bind('mouseover', _tipDisabledBuyout(info.id));
			$(this).find('input[data-auction2-buyout-btn]').bind('mouseout', _untip);
			$(this).find('input[data-auction2-buyout-btn]').bind('click', _buyout(info.id));
			
			$(this).find('[data-auction2-amount]').each(function() {
				var _tip = _translations.POPULATION_TOOLTIP.replace(
					'%1$s',
					number_format(parseInt($(this).attr('data-auction2-amount')))
				);
				$(this).bind('mouseover', function() {
						Tip(_tip);
				});
			});
			$(this).find('[data-auction2-amount]').bind('mouseout', _untip);
		});
		
		_updateTimerDisplay();	// Initially set timer display
		
		// Set timer function to syncronize the timer and to update the timer display
		var _timer = setInterval(function() {
			_turnTimeLeft--;
			if (_turnTimeLeft < 0) {
				// Turn has expired - reload page
				clearInterval(_timer);
				window.location.reload();
				return;
			}
			_updateTimerDisplay();

			// Have pull requests more often in the last 90 seconds of the turn
			var updateInterval = _turnTimeLeft > 600 ? 90 : 10;
			_timerTicks++;
			if (_timerTicks % updateInterval == 0) {	// Make pull request
				_applyMethod('nop', {});
			}
		}, 1000);
	}
	
	// Attach event handlers to side menu
	_auctionTabBtn.click(_showPackagesTab);
	_winnersTabBtn.click(_showWinnersTab);
	_winsTabBtn.click(_showWinsTab);
	_timerDisplay.parent().bind('mouseover', function() {
		Tip(_translations.TIMER_TOOLTIP);
	});
	_timerDisplay.parent().bind('mouseout', _untip);
	_buyoutPopLeftLabel.bind('mouseover', function() {
		Tip(_translations.BUYOUT_POP_LEFT_LABEL_TOOLTIP);
	});
	_buyoutPopLeftLabel.bind('mouseout', _untip);
	
	// Show a tab if needed
	if (displayTab == 'winners') {
		_showWinnersTab();
	} else if (displayTab == 'wins') {
		_showWinsTab();
	}
	
	// Export some of the methods as public
	this.showWinnersTab = _showWinnersTab;
	this.showWinsTab = _showWinsTab;

}