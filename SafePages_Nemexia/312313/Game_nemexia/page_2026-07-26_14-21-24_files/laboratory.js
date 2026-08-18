function loadScience() {
	$.post("ajax_laboratory.php",{
		type: 'loadScience'
	}, function(response) {
		var info = eval('('+ response + ')');
		$("#TabBasic").html(info[1]);
		$("#TabAdvanced").html(info[2]);
		$("#TabMaster").html(info[3]);
		$("#TabAdditional").html(info[4]);
		getSciencesInQue();
	});
	
}

function startScan(planetId, isInstant) {
	if (planetId == undefined) {
		planetId = 0;
	}
	
	if (isInstant == undefined) {
		isInstant = 0;
	}
	
	$.post("ajax_laboratory.php",{
		type: 'scanForSpy',
		planet_id: planetId,
		is_instant: isInstant
	}, function(response) {
		var info = eval('('+ response + ')');
		
		if (isInstant > 0) {
			refreshSession('session');
		}
		
		if (info.status == true && info.locked == true) {
			showConfirm(info.message, function(){startScan(planetId, 1)}, null, StringSpyScanInstantBtnLabel, Cancel);
		} else {
			showDialogMessage(info.message);
		}
		
	});
}

function chooseResearcheTime(scienceId, type) {
	$("#dialogBox").html('<p>' + researchMsg + '</p><div class="dialogButtons"><input type="button" value="'+button1+'" id="button1" />&nbsp;&nbsp;<input type="button" value="'+button2+'" id="button2" /></div>');
	$("#dialogMessage").fadeIn('fast');
	$('#button1').click(function(){
	  $("#dialogMessage").fadeOut('fast', function(){
	  	researchScience(scienceId,0);
	  });
	});
	$('#button2').click(function(){
	  $("#dialogMessage").fadeOut('fast', function(){
	  	researchScience(scienceId,1);
	  });
	});
}

function researchScience(scienceId, startType) {
	//AudioManager.play.processStart();
	$.post("ajax_laboratory.php",{
		type: 'researchScience',
		id: scienceId,
		startType:startType
	}, function(response) {
		if(response == 1) {
			//localStorage.clear();
			try {
			  localStorage.removeItem('expiretime');
			  localStorage.removeItem('positions');
			}
			catch(err) {}			
			loadScience();
			globalQueueLoad();
			refreshSession('planet');
		} else {
			showDialogMessagePopup(response);
		}
	});
}

function finishScience() {
	$.post("ajax_laboratory.php",{
		type: 'checkForReadyScience'
	}, function(response) {
		loadScience();
		setTimeout(function() {firePremiumPopupEvent('resourceIncomeChange');}, 500);
	});
}

function boostProcessScience(processId) {
	new ProcessesBoosterManager().showApplyConfirm('sciences', processId, function() {
		loadScience();
		globalQueueLoad();
	});
}

function cancelScience(process_id) {
	$.post("ajax_laboratory.php",{
		type: 'cancelScience',
		cancelId: process_id
	}, function(response) {
		Timers= new Array();
		CountTimers=0; //Reset the timer
		loadScience();
		globalQueueLoad();
		refreshSession('planet');
	});
}

function getSciencesInQue() {
	$.post("ajax_laboratory.php", {
		type: 'getSciencesInQue'
	}, function(response) {
		$('#queHolder').html(response);
	});
}
