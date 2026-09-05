var NoxMutation = new Array();
NoxMutation[2] = {'ShipId':1, 'count':1};
NoxMutation[4] = {'ShipId':3, 'count':1};
NoxMutation[5] = {'ShipId':3, 'count':2};
NoxMutation[6] = {'ShipId':3, 'count':3};
NoxMutation[7] = {'ShipId':4, 'count':1};
NoxMutation[8] = {'ShipId':4, 'count':1};
NoxMutation[9] = {'ShipId':12,'count':SHIPS_9_REQUIREMENT_12_COUNT};


function trainDefence(id) {
	//AudioManager.play.processStart();
	$.post("ajax_ships.php",{
				type: 'trainDefence',
				count: $("#DefenceId" + id).val(),
				defence_id: id
			}, function(json) {
				var info = eval('(' + json + ')');
				if(info[0] == 'True') {
					//localStorage.clear();
					try {
					  localStorage.removeItem('expiretime');
					  localStorage.removeItem('positions');
					}
					catch(err) {}
					$("#DefenceId" + id).val('');
					refreshShipyard('Defence');
					refreshSession('planet','refreshMax(\'Defence\');');
					globalQueueLoad();
				} else {
					showDialogMessagePopup(info[1]);
				}
	});
}

function trainCommanderShip(id) {
	//AudioManager.play.processStart();
	$.post("ajax_ships.php",{
				type: 'trainCommanderShip',
				ship_id: id
			}, function(json) {
				var info = eval('(' + json + ')');
				if(info[0] != 'True') {
					//localStorage.clear();
					try {
					  localStorage.removeItem('expiretime');
					  localStorage.removeItem('positions');
					}
					catch(err) {}
					showDialogMessagePopup(info[1]);
					return;
				}
				$('#commanderShipsTrainForm-' + id + ' a').attr('href', 'javascript: void(0);').html('&nbsp;');
				
				commanderShipsShowRepairInfo(id);
				
				refreshQue('commanderShips');
				refreshSession('planet');
	});
}

function buyCommanderShip(id) {
	//AudioManager.play.processStart();
	var btnClicked = $('#commanderShipsTrainForm-' + id + ' a.orderCredits');
	var tag = btnClicked.attr('data-is-repair') == 'true' ? TAG_CS_BUY_REPAIR_CONFIRM : TAG_CS_BUY_SHIP_CONFIRM;
	tag = tag.replace('%1$s', btnClicked.attr('data-price-credits'));
	showConfirm(
		tag,
		function() {
			$.post("ajax_ships.php",{
				type: 'buyCommanderShip',
				ship_id: id
			}, function(json) {
				var info = eval('(' + json + ')');
				if(info[0] != 'True') {
					//localStorage.clear();
					try {
					  localStorage.removeItem('expiretime');
					  localStorage.removeItem('positions');
					}
					catch(err) {}
					showDialogMessagePopup(info[1]);
					return;
				}
				$('#commanderShipsTrainForm-' + id + ' a').attr('href', 'javascript: void(0);').html('&nbsp;');
				
				commanderShipsShowRepairInfo(id);
				
				refreshSession('session');
			});
		}
	);
}

function commanderShipsShowBuildInfo(shipId) {
	$('#structureItem-' + shipId + ' span.resourcesBuild').show();
	$('#structureItem-' + shipId + ' span.resourcesRepair').hide();

	$('#structureItem-' + shipId + ' .shipTime.build').show();
	$('#structureItem-' + shipId + ' .shipTime.repair').hide();
}

function commanderShipsShowRepairInfo(shipId) {
	$('#structureItem-' + shipId + ' span.resourcesBuild').hide();
	$('#structureItem-' + shipId + ' span.resourcesRepair').show();

	$('#structureItem-' + shipId + ' .shipTime.build').hide();
	$('#structureItem-' + shipId + ' .shipTime.repair').show();
}

function trainShips(id) {
	//AudioManager.play.processStart();
	$.post("ajax_ships.php",{
				type: 'train',
				count: $("#ShipId" + id).val(),
				ship_id: id
			}, function(json) {
				var info = eval('(' + json + ')');
				if(info[0] == 'True') {
					//localStorage.clear();
					try {
					  localStorage.removeItem('expiretime');
					  localStorage.removeItem('positions');
					}
					catch(err) {}
					$("#ShipId" + id).val('');
					refreshShipyard('Ships');
					refreshSession('planet','refreshMax(\'Ships\');');
					globalQueueLoad();
				} else {
					showDialogMessagePopup(info[1]);
				}
	});
}

function trainAllShips() {
	//AudioManager.play.processStart();	
	var IDs = new Array();
	for(var i =0; i<15; i++) { 
		if(document.getElementById('ShipId' + i))
			if($('#ShipId' + i).val() == "")
				IDs[i] = 0;
			else 
				IDs[i] = $('#ShipId' + i).val();
		else
			IDs[i] = 0;
	}		
	$.post("ajax_ships.php",{
				type: 'trainAll',
				'id_array[]': IDs
			}, function(json) {
				var info = eval('(' + json + ')');
				if(info[0] == 'True') {
					//localStorage.clear();
					try {
					  localStorage.removeItem('expiretime');
					  localStorage.removeItem('positions');
					}
					catch(err) {}
					for(var i =0; i<15; i++) { 
						$("#ShipId" + i).val('0');
					}
					calculateQueTime();
					refreshShipyard('Ships');
					refreshSession('planet','refreshMax("Ships");');
					globalQueueLoad();
				} else {
					showDialogMessagePopup(info[1]);
				}
			});
}

function refreshQue(typeQue) {
	$("#queueWrapper").fadeOut('fast');
	$("#structuresQueue").slideUp("normal",function(){
		$.post("ajax_ships.php",{
					type: 'que',
					typeRefresh: typeQue
				}, function(json) {
					var info = eval('(' + json + ')');
			
					var type = typeQue.replace(typeQue.charAt(0), typeQue.charAt(0).toLowerCase());
					
					var unitIdKey = '';
					var unitInfoType = '';
					if (type == 'ships') {
						unitIdKey = 'ship_id';
						unitInfoType = 'ship';
					} else if (type == 'commanderShips') {
						unitIdKey = 'commander_ship_id';
						unitInfoType = 'commander_ship';
					} else if (type == 'defence') {
						unitIdKey = 'defence_id';
						unitInfoType = 'defence';
					}
					
					Timers=new Array();
					if(typeof(info[0])!="undefined") {
						var CountTimers = 0;
						var queBox = '<div id="queueBackground"> <h2>' + '<span class="queueTime">' + LangStrings[0] + ': <big id="totalQueTime">' + info[0][0] + '</big></span>' + LangStrings[1] + '</h2><div id="queueWrapper" style="display: none;">';
						Timers[CountTimers++] = new Array('totalQueTime', info[0][0], '');

						for(i=1;i<info.length;i++) {
							var imageAddress = '';
							if (type == 'ships') {
								imageAddress = '<img src="' + GLOBAL_HTTP_PATH_IMAGES + 'img/v2.0/img/ships/race' + RACE_ID + '/thumbs/ship_' + info[i][unitIdKey] + '.png" width="50" height="50" border="0" />';
							} else if (type == 'commanderShips') {
								imageAddress = '<img src="' + GLOBAL_HTTP_PATH_IMAGES + 'img/v2.0/img/report/commander_ships/d_cs' + info[i][unitIdKey] + '.png" width="50" height="50" border="0" />';
							} else if (type == 'defence') {
								imageAddress = '<img src="' + GLOBAL_HTTP_PATH_IMAGES + 'img/v2.0/img/defence/race' + RACE_ID + '/thumbs/defence_' + info[i][unitIdKey] + '.png" width="50" height="50" border="0" />';
							}
							
							queBox = queBox + 
								'<div id="queueItem' + i + '" class="queueItem' + ((RACE_ID == 3 && type != 'commanderShips' && type != 'defence' && ((info[i][unitIdKey] >= 4 && info[i][unitIdKey] <= 9) || info[i][unitIdKey] == 2))?' mutation':'') + '">' +
									'<div class="thumbnail">' +
										'<span>' + number_format(info[i]['count']) + '</span>' +
										'<a href="information.php?type=' + unitInfoType + '&id=' + info[i][unitIdKey] + '">' +
											 imageAddress +
										'</a>' +
								'   </div>' +
									'<div class="details">' +
										'<h3><a href="information.php?type=' + unitInfoType + '&id=' + info[i][unitIdKey] + '">' + info[i]['name'] + '</a></h3>' +
										'<div class="status">' +
											'<a href="javascript:void(0);" onclick="showConfirm(\'' + LangStrings[3] + '\', function(){cancel(' + info[i]['proc_id'] + ',\'' + typeQue + '\');});" data-tooltip="' + LangStrings[2] + '" class="cancelItem"></a>' +
											(PROCESSES_BOOSTER_ALLOWED && type != 'commanderShips' ? '<a href="javascript:void(0);" onclick="boostProcessUnits(' + info[i]['proc_id'] + ', \'' + typeQue + '\')" class="processBoostItem">' + LangStrings[4] + '</a>' : '') +
											'<span id="TimeDiff'+ info[i]['proc_id'] + '">' + info[i]['timediff'] + '</span>' +
										'</div>' +
									'</div>' +
								'</div>';
							Timers[CountTimers++] = new Array('TimeDiff'+info[i]['proc_id'], info[i]['timediff'], 'refreshShipyard(\'' + typeQue + '\')');
						}
						queBox = queBox + '</div></div>';
						$("#structuresQueue").html(queBox);
						for (i=1;i<info.length;i++) {
							queueTooltipsRemoveAll(i);
							ququeTooltipAdd(i, info[i]['endDateString']);
						}
						$("#queueWrapper").fadeIn('fast');
						$("#structuresQueue").slideDown("slow");
					} else {
						$("#structuresQueue").html('');
					}
					
					if (typeQue == 'Defence') {
						$('#resourceBoxHangarShips').hide();
						$('#resourceBoxHangarDefence').show();
						HANGAR_VALUE_SOURCE = 'defence_pop_used';
					} else {
						$('#resourceBoxHangarShips').show();
						$('#resourceBoxHangarDefence').hide();
						HANGAR_VALUE_SOURCE = 'pop_used';
					}
					
					headerAttentionSignsUpdate();
					
					return;
			});
	});
}

function refreshMax(type) {
	var x;
	var max=0;
	var tmp=0;
	var pop=0;
    
	pop = PLAYER['pop'] - PLAYER['pop_used'];
	
	var MaxFor = 14;
	if(type == 'Defence') {
		MaxFor = 11;
		pop = PLAYER['pop'] - PLAYER['defence_pop_used'];
	}
	
	for (x=1; x < MaxFor; x++) {
		if(document.getElementById(type + 'NeededMetal-' + x)) {
			max = Math.floor(PLAYER['metal'] / $('#' + type + 'NeededMetal-' + x).html());
			if(max > 0) {
				tmp=Math.floor(PLAYER['crystal'] / $('#' + type + 'NeededCrystal-' + x).html());
				if(max > tmp) max=tmp;
				if(max > 0) {
					tmp=Math.floor(PLAYER['gas'] / $('#' + type + 'NeededGas-' + x).html());
					if(max > tmp) max=tmp;
					if(max > 0) {
						tmp=Math.floor(pop / $('#' + type + 'NeededPop-' + x).html());
						if(max > tmp) max=tmp;
					}	
				}
			}
			
			if (type != 'Defence' && RACE_ID == 3) {
				var maxForNoxVal = maxForNox(type, x);

				if (maxForNoxVal !== false) {
					max = Math.min(max, maxForNoxVal);
				}
			}

			if(max=='' || max == null || max < 0) {
				max='0';
			}
			$('#' + type + 'Max' + x).html(max);
			$('#' + type + 'MaxDisp' + x).html(number_format(max));
		}
	}
}

function maxForNox(type, unitId) {
	if (!isset(NoxMutation[unitId])) {
		return false;
	}

	var avail = $('#' + type + 'Avaible-' + NoxMutation[unitId].ShipId).html() * 1;
	var maxMut = Math.floor(avail / NoxMutation[unitId].count);

	return maxMut;
}

function calculateQueTime() {
	var shipTimers = new Array();
	for (x=1; x < 14; x++) {
		if(document.getElementById('ShipTimeId' + x) && document.getElementById('ShipId' + x) && ($('#ShipId' + x).val()*1) > 0) {
			shipTimers[shipTimers.length] = ($('#ShipTimeId' + x).val() * ($('#ShipId' + x).val() * 1));
		}
	}
	if(shipTimers.length > 0) {
		var maxTime = Math.max.apply( Math, shipTimers);
		var endTime = maxTime * 0.5 * (shipTimers.length+1);
		endTime = Math.round(endTime);
		$('#queTimer').html(SecToTime(endTime));
	} else {
		$('#queTimer').html(SecToTime(0));
	}
}

function boostProcessUnits(processId, type) {
	new ProcessesBoosterManager().showApplyConfirm(type.toLowerCase(), processId, function() {
		refreshShipyard(type);
		globalQueueLoad();
		refreshSession('planet', 'refreshMax("' + type + '");');
	});
}

function cancel(id,type) {
	$.post("ajax_ships.php",{
			type: 'cancel',
			typeCancel: type,
			id: id
		}, function(json) {
			var info = eval('(' + json + ')');
			if(info[0] == 'True') {
				//localStorage.clear();
				try {
				  localStorage.removeItem('expiretime');
				  localStorage.removeItem('positions');
				}
				catch(err) {}
				if (type == 'commanderShips') {
					$('#commanderShipsTrainForm-' +  info[1]['ship_id'] + ' a.orderRes')[0].href = 
						'javascript:trainCommanderShip(' + info[1]['ship_id'] + ')';
					$('#commanderShipsTrainForm-' +  info[1]['ship_id'] + ' a.orderCredits')[0].href = 
						'javascript:buyCommanderShip(' + info[1]['ship_id'] + ')';
					if (info[1]['is_built']) {
						$('#commanderShipsTrainForm-' + info[1]['ship_id'] + ' a.orderRes').html(TAG_CS_RESOURCE_REPAIR);
						$('#commanderShipsTrainForm-' + info[1]['ship_id'] + ' a.orderCredits').html(TAG_CS_CREDITS_REPAIR);
						commanderShipsShowRepairInfo(info[1]['ship_id']);
					} else {
						$('#commanderShipsTrainForm-' + info[1]['ship_id'] + ' a.orderRes').html(TAG_CS_RESOURCE_ORDER);
						$('#commanderShipsTrainForm-' + info[1]['ship_id'] + ' a.orderCredits').html(TAG_CS_CREDITS_ORDER);
						commanderShipsShowBuildInfo(info[1]['ship_id']);
					}
					refreshQue(type);
				} else {
					refreshShipyard(type);
					globalQueueLoad();
				}
				refreshSession('planet','refreshMax("' + type + '");');
			} else {
				showDialogMessagePopup(info[1]);
			}
			return;
	});
}

function getAvaible(type, callback) {
	$.post("ajax_ships.php",{
			type: 'getAvaible',
			typeAvaible: type
		}, function(json) {
			var info = eval('(' + json + ')');

			$.each(info['list'], function(i, n) {
				$('#' + type + 'Avaible-' + i).html(n);
				$('#' + type + 'AvaibleDisp-' + i).html(number_format(n));
			});
			
			executeCallback(callback);
			return;
	});
}

function refreshShipyard(type) {
	getAvaible(type, function (){
		refreshMax(type);
	});
	refreshQue(type);
	globalQueueLoad();
}

function queueTooltipsRemoveAll(itemId) {
	$('#queueWrapper #queueItem' + itemId).unbind('mouseenter');
	$('#queueWrapper #queueItem' + itemId).unbind('mouseleave');
	$('#queueWrapper #queueItem' + itemId + ' a').unbind('mouseenter');
	$('#queueWrapper #queueItem' + itemId + ' a').unbind('mouseleave');
}

function ququeTooltipAdd(itemId, endDateString) {
	$('#queueWrapper #queueItem' + itemId).bind('mouseenter', function(){Tip(endDateString);});
	$('#queueWrapper #queueItem' + itemId).bind('mouseleave', function(){UnTip();});
	$('#queueWrapper #queueItem' + itemId + ' a').bind('mouseenter', function(){UnTip();});
	$('#queueWrapper #queueItem' + itemId + ' a').bind('mouseleave', function(){Tip(endDateString);});
	$('#queueWrapper #queueItem' + itemId + ' a.cancelItem').bind('mouseenter', function(){Tip($(this).attr('data-tooltip'));});
}
