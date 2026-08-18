

function loadUpgrades() {
	Timers = new Array();
	CountTimers = 0;
	$.post(AJAX_CONTROLLER,{
		type: 'loadUpgrades'
	}, function(response) {
		$("#TabShips").html(response);
	});
	getUpgradeInQue();
}

function upgradeShip(shipId) {
	//AudioManager.play.processStart();
	$.post(AJAX_CONTROLLER,{
		type: 'upgradeShip',
		id: shipId
	}, function(response) {
		if(response == 1) {
			//localStorage.clear();
			try {
			  localStorage.removeItem('expiretime');
			  localStorage.removeItem('positions');
			}
			catch(err) {
			  
			}
			loadUpgrades();
			refreshSession('planet');
			globalQueueLoad();
		} else {
			showDialogMessagePopup(response);
		}
	});
}

function buyUpgradeShip(shipId, credits) {
	//AudioManager.play.processStart();
	var confirmText = TAG_CS_BUY_UPGRADE_CONFIRM.replace('%1$s', credits);
	showConfirm(confirmText, function(){
		$.post(AJAX_CONTROLLER,{
			type: 'buyCommanderUpgrade',
			id: shipId
		}, function(response) {
			if(response == 1) {
				//localStorage.clear();
				try {
				  localStorage.removeItem('expiretime');
				  localStorage.removeItem('positions');
				}
				catch(err) {
				  
				}
				loadUpgrades();
				refreshSession('session');
			} else {
				showDialogMessagePopup(response);
			}
		});
	});
}

function finishUpgrade() {
	$.post(AJAX_CONTROLLER,{
		type: 'checkForReady'
	}, function(response) {
		loadUpgrades();
		globalQueueLoad();
	});
}

function boostProcessUpgrade(processId) {
	new ProcessesBoosterManager().showApplyConfirm('shipsupgrades', processId, function() {
		loadUpgrades();
		globalQueueLoad();
	});
}

function cancelUpgrade(process_id) {
	$.post(AJAX_CONTROLLER,{
		type: 'cancelUpgrade',
		cancelId: process_id
	}, function(response) {
		loadUpgrades();
		refreshSession('planet');
		globalQueueLoad();
	});
}

function getUpgradeInQue() {
	$.post(AJAX_CONTROLLER, {
		type: 'getUpgradeInQue'
	}, function(response) {
		$('#queHolder').html(response);
	});
}

function updateUpgradePointsDisplay(points) {
	$('#PlayerUpgardePointsAvailable span').html(number_format(parseInt(points), 0, '.', ','));
}

$(document).ready(function() {
	CountDown();
	loadUpgrades();
}); 
