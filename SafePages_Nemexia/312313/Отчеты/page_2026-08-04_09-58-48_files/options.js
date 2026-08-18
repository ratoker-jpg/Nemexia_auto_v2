var ajaxOptionsUrl = 'ajax_options.php?uid='+(new Date()).valueOf();

$(document).ready(function(){
	$('input#slogan').bind('keyup blur change', function(){
		$('div.sloganSymbolsCount current').html(number_format($(this).val().length));
	});
});

function deleteStart() {
	$.post(ajaxOptionsUrl, {
		type: 'deleteStart',
		password: $('#delete_password').val(),
		email: $('#delete_email').val()
	}, function(response){
	    showDialogMessage(response);
	});
}

function deleteStop() {
	$.post(ajaxOptionsUrl, {
		type: 'deleteStop'
	}, function(response){
	    showDialogMessage(response);
	});
}

function deleteProceed() {
	$.post(ajaxOptionsUrl, {
		type: 'deleteProceed'
	}, function(response){
	    showDialogMessage(response);
	});
}

function restartStart() {
	$.post(ajaxOptionsUrl, {
		type: 'restartStart',
		password: $('#restart_password').val(),
		email: $('#restart_email').val()
	}, function(response){
	    showDialogMessagePopup(response, function(){
			document.location.reload(1);
		});
	});
}

function restartStop() {
	$.post(ajaxOptionsUrl, {
		type: 'restartStop'
	}, function(response){
	    showDialogMessagePopup(response, function(){
			document.location.reload(1);
		});
	});
}

function restartProceed() {
	$.post(ajaxOptionsUrl, {
		type: 'restartProceed'
	}, function(response){
		if (response !== '1' && response !== '') {
			showDialogMessagePopup(response);
		} else {
			document.location.reload(1);
		}
	});
}

function deletePlanet(planetId, currentPlanetId, defaultPlanetId) {
	$.post(ajaxOptionsUrl, {
		type: 'deletePlanet',
		planet_id: planetId
	}, function(response){
		var info = eval('('+ response + ')');

		if (info.success == true) {
			if (planetId == currentPlanetId) {
				showDialogMessagePopup(info.msg, function(){window.location.href='change_planet.php?id=' + defaultPlanetId;});
			} else {
				showDialogMessagePopup(info.msg, function(){document.location.reload(true);});
			}
		} else {
			showDialogMessagePopup(info.msg);
		}
	});
}

function changeDefaultPlanet(planetId) {
	$.post(ajaxOptionsUrl, {
		type: 'changeDefaultPlanet',
		planet_id: planetId
	}, function (response) {
		if (response.success == true) {
			showDialogMessagePopup(response.msg, function () {
				refreshSession('session');
				document.location.reload(true);
			});
		} else {
			showDialogMessagePopup(response.msg);
		}
	}, 'json');
}

function hotlinksSave() {
	var postVars = "";

	$('#hotlinksRowsContainer input[id^=hotlinkName_]').each(function(){
		postVars += this.name + '=' + encodeURIComponent(this.value) + '&';
	});
	
	$('#hotlinksRowsContainer input[id^=hotlinkUrl_]').each(function(){
		postVars += this.name + '=' + encodeURIComponent(this.value) + '&';
	});
	
	postVars += 'type=hotlinksSave';
	
	$.post(ajaxOptionsUrl, postVars, function(response){
		var info = eval('('+ response + ')');
	    showDialogMessage(info.message);
	});
}

function hotlinksAddRow(name, url) {
	// Force tooltip remove without onmouseout
	UnTip();
	
	var currentcount = $('#hotlinksRowsContainer .row').length;
	
	if (currentcount >= hotlinksMaxNumber) {
		return true;
	}
	
	if (name == undefined) {
		name = '';
	}
	
	if (url == undefined) {
		url = '';
	}

	var row = $('#hotlinksRowModel').children('div.row').clone();
	row.find('#hotlinkNameId')
					.attr('id', 'hotlinkName_' + currentcount)
					.attr('name', 'hotlinkName[' + currentcount + ']')
					.val(name);
	row.find('#hotlinkUrlId')
					.attr('id', 'hotlinkUrl_' + currentcount)
					.attr('name', 'hotlinkUrl[' + currentcount + ']')
					.val(url);
	
	$('#hotlinksRowsContainer').append(row);
	
	// Remove the "Add more urls button" and add a new one on the end of the list
	$('#hotlinksAddMoreBtn').remove();
	
	if (currentcount + 1 < hotlinksMaxNumber) {
		$('#hotlinksRowsContainer .row:last').append($('#hotlinksAddButtonModel').html());
		$('#hotlinksRowsContainer .row:last .addMore').attr('id', 'hotlinksAddMoreBtn');
	}
	
	return true;
}

function changePass() {
	$.post(ajaxOptionsUrl, {
		type: 'changePassword',
		old_password: $('#old_password').val(),
		new_password1: $('#new_password1').val(),
		new_password2: $('#new_password2').val()
	}, function(response){
	    showDialogMessage(response);
	});
}

function changeMail() {
    $.post(ajaxOptionsUrl, {
            type: 'changeEmail',
            old_email: $('#old_email').val(),
            new_email: $('#new_email').val()
    }, function(response){
        showDialogMessage(response);
    });
}

function sendConfirm() {
    $.post(ajaxOptionsUrl, {
		type: 'confirmMail'
    }, function(response) {
		var info = eval('('+ response + ')');

		if (info.success == true) {
			refreshSession('session');
			mailConfirmationHide(function() {
				showDialogMessage(info.message);
			});
		} else {
			mailConfirmationHide(function() {
				showDialogMessagePopup(info.message, function() {
					mailConfirmationShow();
				});
			});
		}
    });
}

function mailConfirmationShow() {
	$("#dialogMessage").addClass('mailConfirmation');
	
	$.post(ajaxOptionsUrl, {
		type: 'loadMailConfirmation'
	}, function(response) {
		$("#dialogBox").html(response);
		$('#dialogMessage').fadeIn('fast');
	});
}

function mailConfirmationHide(callback) {
	$('#dialogMessage').fadeOut('slow', function() {
		$("#dialogMessage").removeClass('mailConfirmation');
			
		if (undefined !== callback) {
			if (typeof(callback) == 'string') {
				eval(callback);
			} else if (typeof(callback) == 'function') {
				callback.call();
			}
		}
	});
}

function changeProfile() {
    $.post(ajaxOptionsUrl, $('#formProfile').serialize(), function(response){
        var info = eval('('+ response + ')');
        showDialogMessage(info.info);
    });
}

function loadNotes() {
	$.post(ajaxOptionsUrl, {
		type: 'loadNotes'
	}, function(response){
        $('#playerNotes').val(response);
    });
}

function saveNotes() {
	$.post(ajaxOptionsUrl, {
		type: 'saveNotes',
		notes: $('#playerNotes').val()
	}, function(response){
        showDialogMessage(response);
    });
}

// Vacation
function activateVacation(){
    $.post(ajaxOptionsUrl+'?uid='+(new Date()).valueOf(), {
        type: 'activateVacation'
    }, function(response) {
    	var info = eval('('+ response + ')');
    	if (info.status == true) {
	        refreshSession('session', function(){
	            document.location.reload(1);
	        });
    	} else {
    		showDialogMessagePopup(info.message);
    	}
    });

    return false;
}

function deactivateVacation(){
    $.post(ajaxOptionsUrl+'?uid='+(new Date()).valueOf(), {
        type: 'deactivateVacation'
    }, function(response) {
    	var info = eval('('+ response + ')');
    	if (info.status == true) {
    		refreshSession('session');
        	document.location.href = 'planet.php';
    	} else {
    		showDialogMessagePopup(info.message);
    	}
    });

    return false;
}

function unlockAndDeactivateVacation(){
    $.post(ajaxOptionsUrl+'?uid='+(new Date()).valueOf(), {
        type: 'unlockAndDeactivateVacation'
    }, function(response) {
    	var info = eval('('+ response + ')');
    	if (info.status == true) {
	        refreshSession('session');
	        document.location.href = 'planet.php';
    	} else {
    		showDialogMessagePopup(info.message);
    	}
    });

    return false;
}


function changePlanetName(planetId) {
	$.post(ajaxOptionsUrl, {
		type: 'changePlanetName',
		planet_id: planetId,
		name: $('#editNameInput').val()
	}, function(response){
		var info = eval('('+ response + ')');
			
		if (info.success == true) {
			showDialogMessagePopup(info.msg, function(){document.location.reload(true);});
		} else {
			showDialogMessagePopup(info.msg, function(){editPlanetMenuLoad(planetId);});
		}
	});
	
}

function iframeScript(msg,img) {
	$('#avatarWait').hide();
	
	if(img != 0) {
		var imageHolder = document.getElementById('avatarHolder');
		imageHolder.src = img + '#rand='+(new Date()).getTime();
	}
	
	showDialogMessage(msg);
}

function loadFriendList(type) {
	$.post(ajaxOptionsUrl, {
		type: 'loadFriendList',
		listType: type
	}, function(response){
		if(type == 1) {
			$('#buddyList').html(response);
		} else {
			$('#ignoredList').html(response);
		}
	});
}

function removeFriend(type,id) {
	$.post(ajaxOptionsUrl, {
		type: 'removeFriendList',
		listType:type,
		id: id
	}, function(response){
		loadFriendList(type);
	});
}

function loadSignatures() {
	$.post(ajaxOptionsUrl, {
		type: 'loadSignatures'
	}, function(response){
		$('#TabSignatures').html(response);
	});
}

function saveSignatures() {
	var typeSig = 1;
	for(i=1;i<=7;i++) {
		if(document.getElementById('sig_radio_' + i).checked == true) {
			typeSig = i;
		}
	}
	$.post(ajaxOptionsUrl, {
		type: 'saveSignatures',
		typeSig: typeSig
	}, function(response){
		$('#TabSignatures').html(response);
	});
	
	return false;
}

// When the document is ready set up our sortable with it's inherant function(s)
$(document).ready(function() {
	if ($('#missions-list').length == 0) {
		return true;
	}
	
	arrangeMissions('#missions-list', 0); //Player's Planet
	arrangeMissions('#missions-list-team', 1); //Team Planet
});

function arrangeMissions(ulTab_id, is_team) {
	$(ulTab_id).sortable({
		handle : '.handle',
		update : function () {
			var order = $(ulTab_id).sortable('toArray');

			$.post(ajaxOptionsUrl, {
				type: 'arrangeMissions',
				'itemsList[]': order,
				isTeam: is_team
			}, function(){
				$(ulTab_id + " li label").each( function (i) {
					i = i+1;

					$(this).empty();
					$(this).append(i);
				});
			});
		}
	});
}

function termsConfirm() {
	$.post('ajax_misc.php', {type: 'termsConfirm'}, function(response){
	    var info = eval('('+ response + ')');
	    if (info.status == false) {
	    	showDialogMessagePopup(info.message, function(){document.location.reload(true);});
	    } else {
	    	showDialogMessage(info.message);
	    }
	});
}

function sittersContractPropose() {
	$.post('ajax_sitters.php', {
		type: 'contractPropose',
		nickname: $('#addSitterNickname').val()
	}, function(response){
		var info = eval('('+ response + ')');
		
		showDialogMessage(info.message);
		
		if (info.status == true) {
			sittingLoad('Sitters');
		}
	});
}

function sittersContractTerminate(contractId) {
	$.post('ajax_sitters.php', {
		type: 'contractTerminate',
		contract_id: contractId
	}, function(response){
		var info = eval('('+ response + ')');
		
		showDialogMessage(info.message);
		
		if (info.status == true) {
			sittingLoad('Sitters');
			sittingLoad('Babies');
			
			// Reload the login menu
			sittersLoadSignedBabies(true);
		}
	});
}

function sittersContractAccept(contractId) {
	$.post('ajax_sitters.php', {
		type: 'contractAccept',
		contract_id: contractId
	}, function(response){
		var info = eval('('+ response + ')');
		
		showDialogMessage(info.message);
		
		if (info.status == true) {
			sittingLoad('Babies');
			
			// Reload the login menu
			sittersLoadSignedBabies(true);
		}
	});
}

function sittingLoad(type) {
	$.post('ajax_sitters.php', {
		type: 'loadList' + type
	}, function(response){
		$('#sittingHolder' + type).html(response);
	});
}

function editPlanetMenuLoad(planetId) {
	floatingEnable = 0;
	$("#dialogMessage").addClass('editPlanet');
	
	$.post('ajax_options.php', {
		type: 'loadEditPlanetMenu',
		planet_id: planetId
	}, function(response){
		$("#dialogBox").html(response);
		$('#dialogMessage').fadeIn('fast');
	});
}

function editPlanetMenuClose(callback) {
	$('#dialogMessage').fadeOut('slow', function() {
		$("#dialogMessage").removeClass('editPlanet');
		floatingEnable = 1;
		
        if( undefined !== callback ){
			if(typeof(callback) == 'string') {
				eval(callback);
			} else if (typeof(callback) == 'function') {
				callback.call();
			}
		}
    });
}

function setCommanderShipsPriority(ulTab_id, table_type, is_team) {
	$(ulTab_id).sortable({
		handle : '.handle',
		update : function () {
			var order = $(ulTab_id).sortable('toArray');

			$.post(ajaxOptionsUrl, {
				type: 'setCommanderShipsPriority',
				'itemsList[]': order,
				tableType: table_type,
				isTeam: is_team
			}, function(){
				$(ulTab_id + " li label").each( function (i) {
					i = i+1;

					$(this).empty();
					$(this).append(i);
				});
			});
		}
	});
}

function showCommanderShipPriorities() {
	$.post('ajax_options.php', {
			type: 'loadCommanderShipsPriorities'
		}, function(response) {
			$('#commanderShipsPriority').html(response);
			setCommanderShipsPriority('#priority-defence-list', 0, 0);
			setCommanderShipsPriority('#priority-attack-list', 1, 0);
			if ($('#priority-defence-list-team').length > 0) {
				setCommanderShipsPriority('#priority-defence-list-team', 0, 1);
				setCommanderShipsPriority('#priority-attack-list-team', 1 , 1);
			}
			showTab('commanderShipsPriority');
		}
	);
}