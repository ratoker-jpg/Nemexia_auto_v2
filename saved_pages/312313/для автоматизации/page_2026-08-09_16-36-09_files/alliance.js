var ajaxAllianceUrl = 'ajax_alliance.php';

// Extend global function showTab()
(function() {
	var proxied = window.showTab;
	window.showTab = function() {
		if (arguments[0] != 'detailsTab' && arguments[0] != 'allianceSpecialtiesTab') {
			$('#levelProgressDisplay').slideUp();
		} else {
			$('#levelProgressDisplay').slideDown();
		}
		return proxied.apply(this, arguments);
	};
})();

function ajaxUniqueAllianceUrl() {
	return ajaxAllianceUrl + '?uid=' + (new Date()).valueOf();
}

function loadTabContent(tabId, callback, params){
	var parameters = {type: 'loadTabContent', tabId: tabId};
	for(var i in params) {
		parameters['' + i] = params[i];
	}
	$.post(ajaxUniqueAllianceUrl(), parameters, function(response) {
		$('#'+tabId+'Box').html(response);

		if( undefined !== callback ){
			if(typeof(callback) == 'string') {
				eval(callback);
			} else if (typeof(callback) == 'function') {
				callback.call();
			}
		}
	});
	return false;
}

function allianceProgressPanelToggle() {
	$('#levelProgressBox').toggle('slide', {
		direction: 'up'
	}, 'slow', function(){
		$('#levelProgressToggleLink').toggleClass('show').toggleClass('hide');
	});
}

function allianceProgressPanelToggleShow(state) {
	if (state == true) {
		$('#levelProgressBox').show();
		$('#levelProgressToggleLink').addClass('hide').removeClass('show');
	} else {
		$('#levelProgressBox').hide();
		$('#levelProgressToggleLink').removeClass('hide').addClass('show');
	}
}

function createAlliance() {
	$.post(ajaxAllianceUrl, {
		type: 'createAlliance',
		name: $('#f_alliance_name').val(),
		info: $('#f_alliance_info').val()
	}, function(response){
		var info = eval('(' + response + ')');
		if(info.status == 1) {
			document.location.reload(true);
			return;
		}

		showDialogMessage(info.response);
	});
}

function leaveAlliance() {
	$.post(ajaxAllianceUrl, {
		type: 'leaveAlliance'
	}, function(response){
		var info = eval('(' + response + ')');
		if(info.status == 1) {
			document.location.reload(true);
			return;
		}
		
		showDialogMessage(info.response);
	});
}

function joinAlliance(allianceId) {
	$.post(ajaxAllianceUrl, {
		type: 'joinAlliance',
		alliance_id: allianceId
	}, function(response){
		var info = eval('(' + response + ')');
				
		showDialogMessage(info.response);
	});
}


function editAlliance() {
	$.post(ajaxAllianceUrl, {
		type: 'editAlliance',
		name: $('#f_alliance_name').val(),
		info: $('#f_alliance_info').val()
	}, function(response){
		var info = eval('(' + response + ')');
		
		if (info.status == 1) {
			$('#allianceNameMain').html($('#f_alliance_name').val());
			$('#teamPlanetPrevName').html($('#f_alliance_name').val());
		}
		
		showDialogMessage(info.response);

		loadTabContent('detailsTab');
		showTab('detailsTab');
	});
}

function applicationAccept(playerId) {
	$.post(ajaxAllianceUrl, {
		type: 'applicationAccept',
		player_id: playerId
	}, function(response){
		var info = eval('(' + response + ')');
		if(info.status == 1) {
			$('#app_player_' + playerId).remove();

			showConfirm(info.response, function(){
				showMembersEdit(playerId);
			});
		} else {
			showDialogMessage(info.response);
		}
	});
}

function applicationDecline(playerId) {
	$.post(ajaxAllianceUrl, {
		type: 'applicationDecline',
		player_id: playerId
	}, function(response){
		var info = eval('(' + response + ')');
		if(info.status == 1) {
			$('#app_player_' + playerId).remove();
		}
		
		showDialogMessage(info.response);
	});
}

function applicationRevoke() {
	$.post(ajaxAllianceUrl, {
		type: 'applicationRevoke'
	}, function(response){
		var info = eval('(' + response + ')');
		
		showDialogMessagePopup(info.response, function() {document.location.reload(true);});
	});
}

function setDescendent(playerId) {
	$.post(ajaxAllianceUrl, {
		type: 'setDescendent',
		player_id: playerId
	}, function(response){
		var info = eval('(' + response + ')');
		
		showDialogMessage(info.response);
	});
}

function setLeader(playerId) {
	$.post(ajaxAllianceUrl, {
		type: 'setLeader',
		player_id: playerId
	}, function(response){
		var info = eval('(' + response + ')');
		
		showDialogMessagePopup(info.response, function() {document.location.reload(true);});
	});
}

function setAdmiralOwner(playerId) {
	$.post(ajaxAllianceUrl, {
		type: 'setAdmiralOwner',
		player_id: playerId
	}, function(response){
		var info = eval('(' + response + ')');
		
		showDialogMessage(info.response);
	});
}

function setAssistantLeader(playerId) {
	$.post(ajaxAllianceUrl, {
		type: 'setAssistantLeader',
		player_id: playerId
	}, function(response){
		var info = eval('(' + response + ')');
		
		showDialogMessage(info.response);
	});
}

function politicsModify(mode, politicsId) {
	$.post(ajaxAllianceUrl, {
		type: 'politicsModify',
		mode: mode,
		politics_id: politicsId
	}, function(response){
		var info = eval('(' + response + ')');
		
		showDialogMessage(info.response);

		loadTabContent('incomingPoliticsTab');
		loadTabContent('outgoingPoliticsTab');
		showTab('politicsTab');
	});
}

function politicsAdd(politicsId, allianceId) {
	$.post(ajaxAllianceUrl, {
		type: 'politicsAdd',
		politcs_id: politicsId,
		alliance_id: allianceId
	}, function(response){
		var info = eval('(' + response + ')');
		
		showDialogMessage(info.response);
	});
}

function kickMember(playerId) {
	$.post(ajaxAllianceUrl, {
		type: 'kickMember',
		player_id: playerId
	}, function(response){
		var info = eval('(' + response + ')');
		
		showDialogMessage(info.response);

		loadTabContent('detailsTab');
		showTab('detailsTab');
	});
}

function showMembersEdit(playerId) {
	loadTabContent('editMemberTab', function() { showTab('editMemberTab') }, {player_id: playerId});
}

function pseudoRank(a_perms, t_perms, title){
	if(isset(a_perms) && isset(t_perms)) {
		$("input[id^='alliance_perm_']").each(function() {
			this.checked = (a_perms[this.value] > 0 ? true : false);
		});
		
		$("input[id^='team_perm_']").each(function() {
			this.checked = (t_perms[this.value] > 0 ? true : false);
		});
		
		$('#rank_title').val(title);
		
	} else {
		$("input[id^='alliance_perm_'], input[id^='team_perm_']").each(function() {
			this.checked = false;
		});
		
		$('#rank_title').val('');
	}
}

function saveMember(playerId) {
	var team_perm_data = '';
	var alliance_perm_data = '';
	
	team_perm_data = $.map($("input[id^='team_perm_']:checked"), function(e) { return e.value; }).join(',');
	alliance_perm_data = $.map($("input[id^='alliance_perm_']:checked"), function(e) { return e.value; }).join(',');

	$.post(ajaxAllianceUrl, {
		type: 'saveMember',
		player_id: playerId,
		rank_title: $('#rank_title').val(),
		alliance_perms: alliance_perm_data,
		team_perms: team_perm_data
	}, function(response){
		var info = eval('(' + response + ')');
		
		if (info.status == 1) {
			showDialogMessage(info.response);

			loadTabContent('detailsTab');
			showTab('detailsTab');

			return;
		}
		
		showDialogMessagePopup(info.response);
	});
}

function sendMassMessage() {
	$.post(ajaxAllianceUrl, {
		type: 'sendMassMessage',
		message_body: $('#message_body').val()
	}, function(response){
		var info = eval('(' + response + ')');
		
		if (info.status == 1) {
			showDialogMessage(info.response);

			loadTabContent('detailsTab');
			showTab('detailsTab');

			return;
		}
		
		showDialogMessagePopup(info.response);
	});
}

function createTeamPlanet() {
	$.post(ajaxAllianceUrl, {
		type: 'createTeamPlanet',
		planet_id: $('#tp_source_id').val()
	}, function(response){
		var info = eval('(' + response + ')');
		
		if (info.status == 1) {
			showDialogMessage(info.response);

			loadTabContent('detailsTab');
			showTab('detailsTab');

			return;
		}
		
		showDialogMessagePopup(info.response);
	});
}